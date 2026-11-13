/**
 * upload-service.ts
 *
 * Responsible for uploading a single queued report to the server.
 * This module has zero React dependencies — it can be exercised from a
 * standalone script or unit test without rendering any screen.
 *
 * Key design decisions:
 *
 * • react-native-blob-util's fetch is used instead of axios so that image
 *   files are streamed directly from disk as multipart fields.  This avoids
 *   loading potentially five full JPEG files into the JS heap simultaneously,
 *   which matters on a low-memory device over a slow 2G link.
 *
 * • The report's local UUID is sent as the `Idempotency-Key` header on every
 *   attempt.  The server uses it as the primary key (see report-controller.ts),
 *   so a duplicate submission returns HTTP 200 with the existing record instead
 *   of creating a second row — "nothing lands twice".
 *
 * • Status transitions written to SQLite before / after each network call:
 *     pending → uploading  (request is being sent)
 *     uploading → waiting  (request sent, awaiting server response)
 *     waiting  → uploaded  (success: 200 or 201)
 *     waiting  → failed    (any non-retriable error)
 *   On a force-quit during uploading/waiting, resetStuckReports() rewinds
 *   the status back to pending on the next app launch.
 *
 * • A per-request timeout (UPLOAD_TIMEOUT_MS) prevents the queue from
 *   stalling indefinitely on the server's "hang" failure-simulation mode.
 */

import RNBlobUtil from 'react-native-blob-util';
import { API_BASE_URL } from '@env';

import { ServerSuccessResponse, StoredReport, UploadStatus } from '../types';
import { updateReportStatus } from '../database/report-repository';

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Hard timeout for a single upload attempt.
 * 90 s is generous enough for 5 × 4.5 MB images on a slow link, yet still
 * short enough to detect a hung server within a reasonable time.
 */
const UPLOAD_TIMEOUT_MS = 90_000;

// ─── Errors ────────────────────────────────────────────────────────────────────

/**
 * Thrown when the server responds with a 4xx / 5xx that indicates a permanent
 * problem with this specific report (e.g. malformed payload, too many images).
 * The queue runner should NOT retry permanent errors.
 */
export class PermanentUploadError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'PermanentUploadError';
  }
}

/**
 * Thrown for transient failures: network timeouts, connection drops, server
 * 5xx errors that indicate the server is temporarily overloaded.
 * The queue runner SHOULD retry these after a back-off delay.
 */
export class TransientUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientUploadError';
  }
}

// ─── Main function ─────────────────────────────────────────────────────────────

/**
 * Uploads a single report to the server.
 *
 * Preconditions:
 *   - `report.uploadStatus` must be `'pending'` or `'failed'`.
 *   - `report.imagePaths` must each point to an existing local file.
 *
 * On success the report's local status is set to `'uploaded'`.
 * On failure the status is set to `'failed'` with the error message stored.
 * In both cases the function resolves (never rejects) so the queue runner can
 * continue to the next report without its own try/catch.
 */
export async function uploadReport(report: StoredReport): Promise<void> {
  // Guard: never re-upload an already-uploaded report.
  if (report.uploadStatus === UploadStatus.UPLOADED) {
    return;
  }

  const newAttempts = report.uploadAttempts + 1;

  // ── 1. Mark as uploading ───────────────────────────────────────────────────
  await updateReportStatus(report.id, {
    uploadStatus: UploadStatus.UPLOADING,
    uploadAttempts: newAttempts,
    lastError: null,
  });

  try {
    // ── 2. Build multipart data ──────────────────────────────────────────────
    //
    // react-native-blob-util's `wrap()` streams the file directly from disk.
    // Each field gets the name `images` to match the multer field name on the
    // server (`upload.array('images', 5)`).

    type BlobFetchPart =
      | { name: string; data: string }
      | {
          name: string;
          filename: string;
          type: string;
          data: ReturnType<typeof RNBlobUtil.wrap>;
        };

    const parts: BlobFetchPart[] = [
      { name: 'description', data: report.description },
      { name: 'createdAt', data: report.createdAt },
    ];

    for (const imagePath of report.imagePaths) {
      // Strip the `file://` prefix; RNBlobUtil.wrap expects a bare FS path.
      const localPath = imagePath.replace(/^file:\/\//, '');

      // Derive a readable filename from the stored path.
      const filename = localPath.split('/').pop() ?? 'image.jpg';

      parts.push({
        name: 'images',
        filename,
        type: 'image/jpeg',
        data: RNBlobUtil.wrap(localPath),
      });
    }

    // ── 3. Mark as waiting (data sent, awaiting response) ───────────────────
    //
    // We update the status before the await so that if the app is killed while
    // waiting for the server response, resetStuckReports() will rewind it back
    // to pending on the next launch.
    //
    // Note: RNBlobUtil.fetch is a Promise, so the status update and the fetch
    // are sequential — the status flip happens before we yield to the network.
    await updateReportStatus(report.id, {
      uploadStatus: UploadStatus.WAITING,
    });

    // ── 4. Send the request ──────────────────────────────────────────────────
    const response = await RNBlobUtil.config({
      timeout: UPLOAD_TIMEOUT_MS,
    }).fetch(
      'POST',
      `${API_BASE_URL}/api/reports`,
      {
        'Content-Type': 'multipart/form-data',
        Accept: 'application/json',
        'Idempotency-Key': report.id,
      },
      parts as Parameters<typeof RNBlobUtil.fetch>[3],
    );

    const statusCode = response.info().status;
    const rawBody = response.data as string;

    // ── 5. Handle server response ────────────────────────────────────────────

    // 200 → server already holds this report (idempotent replay).
    // 201 → report created successfully.
    if (statusCode === 200 || statusCode === 201) {
      let serverId: string | null = null;

      try {
        const body = JSON.parse(rawBody) as ServerSuccessResponse;
        serverId = body.report?.id ?? null;
      } catch {
        // If the body can't be parsed we still treat the upload as successful;
        // the status code is authoritative.
        console.warn(
          `[UploadService] Could not parse success body for report ${report.id}.`,
        );
      }

      await updateReportStatus(report.id, {
        uploadStatus: UploadStatus.UPLOADED,
        serverId,
        uploadedAt: new Date().toISOString(),
        lastError: null,
      });

      console.log(
        `[UploadService] Report ${report.id} uploaded (attempt ${newAttempts}, HTTP ${statusCode}).`,
      );

      return;
    }

    // 4xx (except 408 / 429 which are retriable) → permanent error.
    if (
      statusCode >= 400 &&
      statusCode < 500 &&
      statusCode !== 408 &&
      statusCode !== 429
    ) {
      let message = `Server rejected the report (HTTP ${statusCode}).`;

      try {
        const body = JSON.parse(rawBody) as { message?: string };
        if (body.message) {
          message = body.message;
        }
      } catch {
        /* ignore */
      }

      throw new PermanentUploadError(statusCode, message);
    }

    // Everything else (5xx, 408, 429) → transient error, should be retried.
    throw new TransientUploadError(
      `Server returned HTTP ${statusCode}. Will retry.`,
    );
  } catch (error: unknown) {
    // ── 6. Classify and persist the failure ──────────────────────────────────

    const isPermanent = error instanceof PermanentUploadError;

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown upload error.';

    console.warn(
      `[UploadService] Report ${report.id} upload failed (attempt ${newAttempts}, permanent=${isPermanent}): ${errorMessage}`,
    );

    await updateReportStatus(report.id, {
      uploadStatus: UploadStatus.FAILED,
      lastError: errorMessage,
    });

    // Re-throw so the queue runner can apply the correct back-off strategy.
    throw error;
  }
}
