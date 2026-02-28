import type { ReportPayload, ReportResponse } from './widget-types';
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
  onQueued?: (reason: string) => void,
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
      await enqueueReport(apiUrl, sdkKey, payload, 'network-error').catch((qErr) => {
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
// Helper — enqueue a report payload
// ---------------------------------------------------------------------------

async function enqueueReport(
  apiUrl: string,
  sdkKey: string,
  payload: ReportPayload,
  _reason: string,
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
