import type { ReportPayload, ReportResponse, TicketStatusResponse } from './widget-types';
import { OfflineQueue } from '../offline-queue';

// Lazily-created shared queue instance (one per page load).
let _queue: OfflineQueue | null = null;

/**
 * Returns the shared OfflineQueue, creating and initialising it on first call.
 * Safe to call multiple times.
 */
export async function getOfflineQueue(): Promise<OfflineQueue> {
  if (!_queue) {
    _queue = new OfflineQueue();
    await _queue.initialize();
  }
  return _queue;
}

/**
 * Replace the shared queue instance (intended for testing only).
 * @internal
 */
export function _setOfflineQueueForTesting(queue: OfflineQueue | null): void {
  _queue = queue;
}

// ---------------------------------------------------------------------------
// Core submit function
// ---------------------------------------------------------------------------

/**
 * Submit a bug report to the API.
 *
 * When the browser is offline (navigator.onLine === false) **or** when the
 * request fails with a network error, the report is automatically queued in
 * IndexedDB for later submission.
 *
 * @returns The API response when the report was sent immediately, or
 *          `null` when the report was queued for later delivery.
 */
export async function submitReport(
  apiUrl: string,
  sdkKey: string,
  payload: ReportPayload,
  timeout = 60000,
  onQueued?: (reason: string) => void
): Promise<ReportResponse | null> {
  // When offline, skip the network attempt and queue directly.
  if (!navigator.onLine) {
    await enqueueReport(apiUrl, sdkKey, payload, 'offline');
    onQueued?.('offline');
    return null;
  }

  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('description', payload.description);
  formData.append('userContext', JSON.stringify(payload.userContext));

  if (payload.videoBlob) {
    const ext = payload.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('video', payload.videoBlob, `recording_${Date.now()}.${ext}`);
  }

  if (payload.screenshotBlob) {
    formData.append('screenshot', payload.screenshotBlob, `screenshot_${Date.now()}.png`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiUrl}/api/sdk/tickets/report`, {
      method: 'POST',
      headers: { 'x-sdk-key': sdkKey },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
    }

    return response.json() as Promise<ReportResponse>;
  } catch (error) {
    clearTimeout(timeoutId);

    // AbortError from our timeout should propagate — it is not a network failure.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Report submission timed out');
    }

    // For any other network-level error (TypeError: Failed to fetch, etc.)
    // queue the report and return null so the widget can show a "queued" state.
    const isNetworkError = error instanceof TypeError;
    if (isNetworkError) {
      await enqueueReport(apiUrl, sdkKey, payload, 'network-error').catch(qErr => {
        // If queuing itself fails, log and rethrow the original error.
        console.warn('[OfflineQueue] Failed to queue report:', qErr);
      });
      onQueued?.('network-error');
      return null;
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Polling — GET /api/sdk/tickets/:id
// ---------------------------------------------------------------------------

/** Interval between poll attempts (ms). */
export const POLL_INTERVAL_MS = 5000;

/** Maximum time to wait for AI results before giving up (ms). */
export const POLL_TIMEOUT_MS = 120_000;

/**
 * Callback invoked on each successful poll.
 * Return `true` from `onResult` to stop polling early (results received).
 */
export interface PollCallbacks {
  /** Called when a successful response is received. Return true to stop. */
  onResult: (ticket: TicketStatusResponse) => boolean;
  /** Called when the 2-minute timeout is reached without receiving results. */
  onTimeout: () => void;
}

/**
 * Start polling `GET /api/sdk/tickets/:id` every {@link POLL_INTERVAL_MS} ms
 * for a maximum of {@link POLL_TIMEOUT_MS} ms.
 *
 * Returns a `stop()` function that cancels ongoing polling immediately.
 * Polling stops automatically when:
 *   - `onResult` returns `true` (AI summary received)
 *   - The timeout is reached
 *   - `stop()` is called
 *
 * Network errors are silently swallowed — polling continues until timeout.
 */
export function pollTicketStatus(
  apiUrl: string,
  sdkKey: string,
  ticketId: string,
  callbacks: PollCallbacks,
  intervalMs = POLL_INTERVAL_MS,
  timeoutMs = POLL_TIMEOUT_MS
): { stop: () => void } {
  let stopped = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function cleanup(): void {
    stopped = true;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  async function doPoll(): Promise<void> {
    if (stopped) return;
    try {
      const response = await fetch(`${apiUrl}/api/sdk/tickets/${ticketId}`, {
        method: 'GET',
        headers: { 'x-sdk-key': sdkKey },
      });

      if (stopped) return;

      if (response.ok) {
        const ticket = (await response.json()) as TicketStatusResponse;
        if (stopped) return;
        const done = callbacks.onResult(ticket);
        if (done) {
          cleanup();
        }
      }
      // Non-2xx responses are silently ignored — polling continues.
    } catch {
      // Network errors are silently swallowed — polling continues.
    }
  }

  // Schedule timeout first.
  timeoutId = setTimeout(() => {
    if (stopped) return;
    cleanup();
    callbacks.onTimeout();
  }, timeoutMs);

  // Poll immediately on start, then on each interval.
  void doPoll();
  intervalId = setInterval(() => {
    void doPoll();
  }, intervalMs);

  return { stop: cleanup };
}

// ---------------------------------------------------------------------------
// Helper — enqueue a report payload
// ---------------------------------------------------------------------------

async function enqueueReport(
  apiUrl: string,
  sdkKey: string,
  payload: ReportPayload,
  _reason: string
): Promise<void> {
  const queue = await getOfflineQueue();
  await queue.enqueue({
    title: payload.title,
    description: payload.description,
    userContext: payload.userContext,
    videoBlob: payload.videoBlob,
    apiUrl,
    sdkKey,
  });
}
