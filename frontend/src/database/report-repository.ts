import {
  CreateLocalReportInput,
  LocalReport,
  ReportDatabaseRow,
  StoredReport,
  UpdateReportStatusInput,
  UploadStatus,
} from '../types';
import { MAX_UPLOAD_ATTEMPTS } from '../utils/constant';
import { deleteReportImages, saveReportImages } from '../utils/image-storage';
import { db } from './database';

function rowToStoredReport(row: ReportDatabaseRow): StoredReport {
  const imagePaths: unknown = JSON.parse(row.image_paths);

  if (
    !Array.isArray(imagePaths) ||
    !imagePaths.every(p => typeof p === 'string')
  ) {
    throw new Error(`Invalid image paths for report ${row.id}.`);
  }

  return {
    id: row.id,
    description: row.description,
    imagePaths,
    uploadStatus: row.upload_status,
    reviewStatus: row.review_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    uploadedAt: row.uploaded_at,
    serverId: row.server_id,
    uploadAttempts: row.upload_attempts,
    lastError: row.last_error,
  };
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createLocalReport(
  input: CreateLocalReportInput,
): Promise<LocalReport> {
  const { id, description, images } = input;

  const trimmedDescription = description.trim();

  if (!id.trim()) {
    throw new Error('Report ID is required.');
  }

  if (!trimmedDescription) {
    throw new Error('Report description is required.');
  }

  if (images.length < 1 || images.length > 5) {
    throw new Error('A report must contain between 1 and 5 images.');
  }

  // Step 1: Copy compressed images into permanent storage.
  const savedImages = await saveReportImages(id, images);

  const imagePaths = savedImages.map(image => {
    if (!image.uri) {
      throw new Error('A saved image is missing its URI.');
    }

    return image.uri;
  });

  const now = new Date().toISOString();

  try {
    // Step 2: Save the report in SQLite.
    await db.transaction(async tx => {
      await tx.execute(
        `
          INSERT INTO reports (
            id,
            description,
            image_paths,
            upload_status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?);
        `,
        [
          id,
          trimmedDescription,
          JSON.stringify(imagePaths),
          'pending',
          now,
          now,
        ],
      );
    });

    // Step 3: Return the locally saved report.
    return {
      id,
      description: trimmedDescription,
      imagePaths,
      uploadStatus: 'pending',
      createdAt: now,
    };
  } catch (error) {
    // Step 4: Remove copied images if SQLite insertion fails.
    try {
      await deleteReportImages(id);
    } catch (cleanupError) {
      console.error('Failed to clean up report images:', cleanupError);
    }

    throw error;
  }
}

// ─── Read all ──────────────────────────────────────────────────────────────────

export async function getLocalReports(): Promise<StoredReport[]> {
  const result = await db.execute(`
    SELECT *
    FROM reports
    ORDER BY created_at DESC;
  `);

  const rows = result.rows as unknown as ReportDatabaseRow[];

  return rows.map(rowToStoredReport);
}

// ─── Read pending / failed ─────────────────────────────────────────────────────

/**
 * Returns all candidate reports that the queue runner can attempt to upload.
 * It includes:
 * 1. 'pending' reports (always attempted).
 * 2. 'failed' reports that have not yet exhausted retries (< MAX_UPLOAD_ATTEMPTS).
 *
 * Once a report reaches MAX_UPLOAD_ATTEMPTS, it stops auto-retrying to avoid
 * blocking subsequent reports in the queue.
 */
export async function getPendingReports(): Promise<StoredReport[]> {
  const result = await db.execute(
    `
    SELECT *
    FROM reports
    WHERE upload_status = 'pending'
       OR (upload_status = 'failed' AND upload_attempts < ?)
    ORDER BY created_at ASC;
  `,
    [MAX_UPLOAD_ATTEMPTS],
  );

  const rows = result.rows as unknown as ReportDatabaseRow[];

  return rows.map(rowToStoredReport);
}

// ─── Update upload status ──────────────────────────────────────────────────────

/**
 * Atomically updates the mutable upload fields for a single report.
 * Only the fields explicitly included in `input` are changed;
 * columns for omitted optional fields keep their current database value.
 */
export async function updateReportStatus(
  id: string,
  input: UpdateReportStatusInput,
): Promise<void> {
  const now = new Date().toISOString();

  // Always-updated columns.
  const setClauses: string[] = ['upload_status = ?', 'updated_at = ?'];
  const params: (string | number | null)[] = [input.uploadStatus, now];

  // Optional columns — only included when the caller passes them explicitly.
  if ('uploadAttempts' in input && input.uploadAttempts !== undefined) {
    setClauses.push('upload_attempts = ?');
    params.push(input.uploadAttempts);
  }

  if ('lastError' in input) {
    setClauses.push('last_error = ?');
    params.push(input.lastError ?? null);
  }

  if ('serverId' in input) {
    setClauses.push('server_id = ?');
    params.push(input.serverId ?? null);
  }

  if ('uploadedAt' in input) {
    setClauses.push('uploaded_at = ?');
    params.push(input.uploadedAt ?? null);
  }

  params.push(id); // WHERE id = ?

  await db.execute(
    `UPDATE reports SET ${setClauses.join(', ')} WHERE id = ?;`,
    params,
  );
}

// ─── Retry failed reports ──────────────────────────────────────────────────────

/**
 * Resets a single failed report back to 'pending' so the queue runner retries it.
 */
export async function retryReport(id: string): Promise<void> {
  await updateReportStatus(id, {
    uploadStatus: UploadStatus.PENDING,
    uploadAttempts: 0,
    lastError: null,
  });
}

/**
 * Resets all 'failed' reports back to 'pending' so the queue runner retries them.
 */
export async function retryAllFailedReports(): Promise<void> {
  const now = new Date().toISOString();

  await db.execute(
    `
    UPDATE reports
    SET upload_status = 'pending',
        upload_attempts = 0,
        last_error = null,
        updated_at = ?
    WHERE upload_status = 'failed';
    `,
    [now],
  );
}

// ─── Reset stuck in-flight reports ────────────────────────────────────────────

/**
 * Any report left in 'uploading' or 'waiting' when the app was killed must be
 * reset to 'pending' so the queue runner retries on the next session.
 */
export async function resetStuckReports(): Promise<void> {
  const now = new Date().toISOString();

  await db.execute(
    `
    UPDATE reports
    SET
      upload_status = 'pending',
      updated_at    = ?
    WHERE upload_status IN ('uploading', 'waiting');
    `,
    [now],
  );
}

// ─── Delete all local reports (reset) ─────────────────────────────────────────

/**
 * Removes every report row from SQLite. The caller is responsible for also
 * deleting the associated image files via `deleteReportImages()`.
 */
export async function deleteAllLocalReports(): Promise<void> {
  await db.execute('DELETE FROM reports;');
}

export { deleteReportImages };
