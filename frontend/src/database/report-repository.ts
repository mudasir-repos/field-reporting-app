import type { Asset } from 'react-native-image-picker';

import { db } from './database';
import { saveReportImages, deleteReportImages } from '../utils/image-storage';
import { ReviewStatus, StoredReport, UploadStatus } from '../types';

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface CreateLocalReportInput {
  id: string;
  description: string;
  images: Asset[];
}

export interface LocalReport {
  id: string;
  description: string;
  imagePaths: string[];
  uploadStatus: string;
  createdAt: string;
}

export interface UpdateReportStatusInput {
  uploadStatus: UploadStatus;
  /** New cumulative attempt count. Pass to increment after each try. */
  uploadAttempts?: number;
  /** Set to null to clear a previous error; omit to leave unchanged. */
  lastError?: string | null;
  /** Set once the server confirms receipt. */
  serverId?: string | null;
  /** ISO timestamp of successful upload. */
  uploadedAt?: string | null;
}

interface ReportDatabaseRow {
  id: string;
  description: string;
  image_paths: string;
  upload_status: UploadStatus;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
  uploaded_at: string | null;
  server_id: string | null;
  upload_attempts: number;
  last_error: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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
 * Returns all reports in `pending` or `failed` state, oldest first.
 * These are the candidates the queue runner will try to upload.
 */
export async function getPendingReports(): Promise<StoredReport[]> {
  const result = await db.execute(`
    SELECT *
    FROM reports
    WHERE upload_status IN ('pending', 'failed')
    ORDER BY created_at ASC;
  `);

  const rows = result.rows as unknown as ReportDatabaseRow[];

  return rows.map(rowToStoredReport);
}

// ─── Update upload status ──────────────────────────────────────────────────────

/**
 * Atomically updates the mutable upload fields for a single report.
 * Only the fields explicitly included in `input` are changed;
 * columns for omitted optional fields keep their current database value.
 *
 * We build the SET clause dynamically so we never pass `undefined` to
 * op-sqlite (its `Scalar` type only accepts string | number | null).
 */
export async function updateReportStatus(
  id: string,
  input: UpdateReportStatusInput,
): Promise<void> {
  const now = new Date().toISOString();

  // Always-updated columns.
  const setClauses: string[] = [
    'upload_status = ?',
    'updated_at = ?',
  ];
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

// ─── Reset stuck in-flight reports ────────────────────────────────────────────

/**
 * Any report left in `uploading` or `waiting` when the app was killed must be
 * reset to `pending` so the queue runner retries on the next session.
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
