/**
 * queue-runner.ts
 *
 * Background upload queue runner for field reports.
 *
 * Key features:
 * - Pure module (no React state or hooks) — runnable without rendering a screen.
 * - Sequential processing: uploads reports one-by-one in the order they were created.
 * - Network-aware: pauses when offline using NetInfo and resumes immediately when online.
 * - Crash-resilient: resets stuck in-flight reports ('uploading' / 'waiting') to 'pending' on startup.
 * - Back-off policy:
 *   - Network error: retries immediately once online.
 *   - Server error (4xx / 5xx): exponential back-off capped at 60 seconds.
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

import {
  getPendingReports,
  resetStuckReports,
} from '../database/report-repository';
import {
  PermanentUploadError,
  TransientUploadError,
  uploadReport,
} from './upload-service';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Delay after a successful upload before picking up the next report (1 second). */
const SUCCESS_DELAY_MS = 1_000;

/** Base back-off for server errors (1 second). */
const BASE_SERVER_BACKOFF_MS = 1_000;

/** Maximum back-off delay for server errors (60 seconds). */
const MAX_SERVER_BACKOFF_MS = 60_000;

/** Time to wait between checking the database when no reports are pending (3 seconds). */
const EMPTY_QUEUE_POLL_MS = 3_000;

/** Tiny yield before retrying a network error (500 ms) so we don't spin tightly. */
const NETWORK_RETRY_DELAY_MS = 500;

// ─── Queue Change Event Emitter ────────────────────────────────────────────────

/**
 * Each listener receives a boolean:
 *   true  — an upload finished successfully (server responded 200/201).
 *   false — an upload failed (network error or server error).
 *
 * The UI uses this to decide whether to also mark the server reports cache stale.
 */
type QueueChangeCallback = (uploadedSuccessfully: boolean) => void;

const queueChangeListeners: QueueChangeCallback[] = [];

/**
 * Subscribe to queue status changes.
 * Returns an unsubscribe function — call it to stop listening (e.g. in useEffect cleanup).
 */
export function onQueueChanged(callback: QueueChangeCallback): () => void {
  queueChangeListeners.push(callback);

  return () => {
    const index = queueChangeListeners.indexOf(callback);
    if (index !== -1) {
      queueChangeListeners.splice(index, 1);
    }
  };
}

/**
 * Called internally after each upload attempt.
 * Pass true if the upload succeeded, false if it failed.
 */
function notifyQueueChanged(uploadedSuccessfully: boolean): void {
  for (const listener of queueChangeListeners) {
    listener(uploadedSuccessfully);
  }
}

// ─── Module-Level State ────────────────────────────────────────────────────────

/** Single boolean flag indicating if the runner loop is actively running. */
let isRunning = false;

/** Promise tracking the currently active loop (useful for clean shutdown/testing). */
let activeLoopPromise: Promise<void> | null = null;

/** Callback to cancel waiting for network connectivity if the runner is stopped. */
let stopWaitingForNetwork: (() => void) | null = null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simple promise-based delay helper.
 */
function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Checks if a NetInfo state indicates active internet connectivity.
 */
function isDeviceOnline(state: NetInfoState): boolean {
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

/**
 * Calculates exponential back-off for server errors (4xx / 5xx) in milliseconds.
 * Formula: min(1000 * 2^(attempts - 1), 60000)
 *
 * Example delays:
 * - Attempt 1: 1s
 * - Attempt 2: 2s
 * - Attempt 3: 4s
 * - Attempt 4: 8s
 * - Attempt 5: 16s
 * - Attempt 6: 32s
 * - Attempt 7+: 60s (capped)
 */
export function calculateServerBackoff(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const backoff = BASE_SERVER_BACKOFF_MS * Math.pow(2, exponent);
  return Math.min(backoff, MAX_SERVER_BACKOFF_MS);
}

/**
 * Checks if an error is a server error (4xx / 5xx).
 * PermanentUploadError: 4xx HTTP responses.
 * TransientUploadError: 5xx, 408, 429 HTTP responses.
 */
export function isServerError(error: unknown): boolean {
  if (error instanceof PermanentUploadError) {
    return true;
  }
  if (error instanceof TransientUploadError) {
    return true;
  }
  if (
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    const code = (error as { statusCode: number }).statusCode;
    return code >= 400 && code < 600;
  }
  return false;
}

/**
 * Pauses execution when offline and resumes immediately when connectivity returns.
 * "Do not burn retries while offline."
 */
async function waitForNetwork(): Promise<void> {
  let isOnline = false;

  try {
    const currentState = await NetInfo.fetch();
    isOnline = isDeviceOnline(currentState);
  } catch {
    // If NetInfo fetch fails (e.g. in test environment), proceed without pausing
    return;
  }

  if (isOnline) {
    return;
  }

  console.log('[QueueRunner] Device is offline. Pausing upload queue...');

  await new Promise<void>(resolve => {
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        stopWaitingForNetwork = null;
        resolve();
      }
    };

    stopWaitingForNetwork = cleanup;

    const unsubscribe = NetInfo.addEventListener(state => {
      if (isDeviceOnline(state)) {
        console.log('[QueueRunner] Connectivity restored. Resuming queue.');
        cleanup();
      }
    });
  });
}

// ─── Main Runner Loop ──────────────────────────────────────────────────────────

/**
 * Continuous loop that processes pending reports one-by-one.
 */
async function runQueueLoop(): Promise<void> {
  // Step 1: On app restart, reset any reports left in 'uploading' or 'waiting' back to 'pending'.
  try {
    await resetStuckReports();
    console.log('[QueueRunner] Reset stuck in-flight reports to pending.');
    // Notify the UI so it shows the corrected statuses on startup.
    notifyQueueChanged(false);
  } catch (error) {
    console.error('[QueueRunner] Failed to reset stuck reports:', error);
  }

  // Step 2: Main loop
  while (isRunning) {
    try {
      // Pause if offline — do not burn retries while offline
      await waitForNetwork();
      if (!isRunning) {
        break;
      }

      // Fetch pending / failed reports, oldest first
      const pendingReports = await getPendingReports();

      // If the queue is empty, wait a short poll interval
      if (pendingReports.length === 0) {
        await delay(EMPTY_QUEUE_POLL_MS);
        continue;
      }

      // Process reports sequentially
      for (const report of pendingReports) {
        if (!isRunning) {
          break;
        }

        // Check connectivity before each report attempt
        await waitForNetwork();
        if (!isRunning) {
          break;
        }

        try {
          console.log(
            `[QueueRunner] Starting upload for report ${report.id} (attempt ${report.uploadAttempts + 1})...`,
          );

          await uploadReport(report);

          console.log(
            `[QueueRunner] Report ${report.id} uploaded successfully.`,
          );

          // Notify the UI: success = true so the screen also stales the server cache.
          notifyQueueChanged(true);

          // Wait a short delay before the next report
          await delay(SUCCESS_DELAY_MS);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown upload error.';

          console.error(
            `[QueueRunner] Upload failed for report ${report.id}:`,
            errorMessage,
          );

          // Notify the UI: success = false, only the queue list needs to refresh.
          notifyQueueChanged(false);

          // Back-off policy:
          // Server error (4xx/5xx): exponential back-off (capped at 60s)
          // Network error: retry immediately once online
          if (isServerError(error)) {
            const attempts = report.uploadAttempts + 1;
            const backoffMs = calculateServerBackoff(attempts);

            console.log(
              `[QueueRunner] Server error. Backing off for ${backoffMs / 1000}s before next attempt...`,
            );
            await delay(backoffMs);
          } else {
            console.log(
              '[QueueRunner] Network error. Will retry immediately.',
            );
            await delay(NETWORK_RETRY_DELAY_MS);
          }
        }
      }
    } catch (loopError) {
      console.error('[QueueRunner] Unexpected loop error:', loopError);
      await delay(EMPTY_QUEUE_POLL_MS);
    }
  }

  console.log('[QueueRunner] Queue runner loop stopped.');
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Starts the background upload queue runner.
 * Lives for the lifetime of the app process and runs sequentially.
 */
export function startQueueRunner(): void {
  if (isRunning) {
    console.log('[QueueRunner] Queue runner is already active.');
    return;
  }

  isRunning = true;
  console.log('[QueueRunner] Starting queue runner...');

  activeLoopPromise = runQueueLoop()
    .catch(error => {
      console.error('[QueueRunner] Fatal error in queue runner:', error);
    })
    .finally(() => {
      isRunning = false;
      activeLoopPromise = null;
    });
}

/**
 * Stops the queue runner loop (useful for testing or teardown).
 */
export async function stopQueueRunner(): Promise<void> {
  isRunning = false;

  if (stopWaitingForNetwork) {
    stopWaitingForNetwork();
    stopWaitingForNetwork = null;
  }

  if (activeLoopPromise) {
    await activeLoopPromise;
  }
}

/**
 * Returns whether the queue runner is currently active.
 */
export function isQueueRunnerRunning(): boolean {
  return isRunning;
}
