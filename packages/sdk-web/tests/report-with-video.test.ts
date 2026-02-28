/**
 * Unit tests for SupportHelper.reportWithVideo()
 *
 * Verifies:
 *   - FormData shape sent to /api/sdk/tickets/report
 *   - x-sdk-key header forwarded correctly
 *   - Ticket ID extracted from response
 *   - Offline-queue fallback when navigator.onLine is false
 *   - Offline-queue fallback on network TypeError
 *   - HTTP errors propagate (not swallowed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupportHelper } from '../src/index';
import { _setOfflineQueueForTesting } from '../src/widget/widget-api';
import { OfflineQueue } from '../src/offline-queue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSdk(customContext?: Record<string, unknown>): SupportHelper {
  return new SupportHelper({
    sdkKey: 'sk_test_123',
    apiUrl: 'https://api.example.com',
    customContext,
  });
}

function makeVideoBlob(sizeBytes = 1024): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type: 'video/webm' });
}

const DEFAULT_OPTIONS = {
  title: 'Button is broken',
  description: 'Clicking the button does nothing',
} as const;

// ---------------------------------------------------------------------------
// Mock OfflineQueue that captures enqueue calls
// ---------------------------------------------------------------------------

function makeMockQueue(): OfflineQueue & { enqueueSpy: ReturnType<typeof vi.fn> } {
  const queue = Object.create(OfflineQueue.prototype) as OfflineQueue;
  const enqueueSpy = vi.fn().mockResolvedValue(undefined);
  // Patch just the methods the code under test actually calls
  (queue as unknown as Record<string, unknown>).enqueue = enqueueSpy;
  (queue as unknown as Record<string, unknown>).initialize = vi.fn().mockResolvedValue(undefined);
  (queue as unknown as Record<string, unknown>).destroy = vi.fn();

  return Object.assign(queue, { enqueueSpy });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  _setOfflineQueueForTesting(null);

  // Default: online
  Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

  // Default: successful fetch response
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ticket: { id: 'ticket-abc', status: 'open' } }),
  } as Response);
});

afterEach(() => {
  _setOfflineQueueForTesting(null);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupportHelper.reportWithVideo()', () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('successful submission', () => {
    it('returns the ticket ID from the API response', async () => {
      const sdk = makeSdk();
      const videoBlob = makeVideoBlob();

      const ticketId = await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob });

      expect(ticketId).toBe('ticket-abc');
    });

    it('posts to /api/sdk/tickets/report', async () => {
      const sdk = makeSdk();

      await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() });

      expect(global.fetch).toHaveBeenCalledOnce();
      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.example.com/api/sdk/tickets/report');
    });

    it('sends the x-sdk-key header', async () => {
      const sdk = makeSdk();

      await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() });

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)['x-sdk-key']).toBe('sk_test_123');
    });

    it('uses POST method', async () => {
      const sdk = makeSdk();

      await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() });

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
    });

    it('sends a FormData body containing title, description, userContext and video', async () => {
      const sdk = makeSdk();
      const videoBlob = makeVideoBlob(2048);

      await sdk.reportWithVideo({
        title: 'My title',
        description: 'My description',
        videoBlob,
      });

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = init.body as FormData;

      expect(body).toBeInstanceOf(FormData);
      expect(body.get('title')).toBe('My title');
      expect(body.get('description')).toBe('My description');

      // userContext must be a serialised JSON string containing at least a url key
      const rawContext = body.get('userContext');
      expect(typeof rawContext).toBe('string');
      const parsedContext = JSON.parse(rawContext as string) as Record<string, unknown>;
      expect(parsedContext).toHaveProperty('url');
      expect(parsedContext).toHaveProperty('userAgent');

      // Video file must be present
      const videoFile = body.get('video');
      expect(videoFile).not.toBeNull();
      expect((videoFile as File).size).toBe(2048);
    });

    it('automatically captures user context without caller providing it', async () => {
      const sdk = makeSdk({ userId: 'user-99' });

      await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() });

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = init.body as FormData;
      const parsed = JSON.parse(body.get('userContext') as string) as Record<string, unknown>;

      // Custom context should be forwarded
      expect((parsed.customContext as Record<string, unknown>)?.userId).toBe('user-99');
    });
  });

  // -------------------------------------------------------------------------
  // Offline queue fallback
  // -------------------------------------------------------------------------

  describe('offline queue fallback', () => {
    it('returns null and enqueues when navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

      const mockQueue = makeMockQueue();
      _setOfflineQueueForTesting(mockQueue);

      const sdk = makeSdk();
      const result = await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() });

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockQueue.enqueueSpy).toHaveBeenCalledOnce();
    });

    it('enqueues with correct title, description and videoBlob', async () => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

      const mockQueue = makeMockQueue();
      _setOfflineQueueForTesting(mockQueue);

      const videoBlob = makeVideoBlob(512);
      const sdk = makeSdk();
      await sdk.reportWithVideo({
        title: 'Queue test',
        description: 'Should be queued',
        videoBlob,
      });

      const queued = mockQueue.enqueueSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(queued.title).toBe('Queue test');
      expect(queued.description).toBe('Should be queued');
      expect(queued.videoBlob).toBe(videoBlob);
      expect(queued.apiUrl).toBe('https://api.example.com');
      expect(queued.sdkKey).toBe('sk_test_123');
    });

    it('returns null and enqueues when fetch throws a network TypeError', async () => {
      Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

      const mockQueue = makeMockQueue();
      _setOfflineQueueForTesting(mockQueue);

      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const sdk = makeSdk();
      const result = await sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() });

      expect(result).toBeNull();
      expect(mockQueue.enqueueSpy).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('throws when the API returns a non-network HTTP error (4xx)', async () => {
      Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

      const mockQueue = makeMockQueue();
      _setOfflineQueueForTesting(mockQueue);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid SDK key'),
      } as Response);

      const sdk = makeSdk();

      await expect(
        sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() }),
      ).rejects.toThrow('HTTP 400');

      // Must not be queued — this is a client error, not a network failure
      expect(mockQueue.enqueueSpy).not.toHaveBeenCalled();
    });

    it('throws when AbortController cancels due to timeout', async () => {
      Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

      global.fetch = vi.fn().mockImplementation(() => {
        const err = new DOMException('The operation was aborted.', 'AbortError');
        return Promise.reject(err);
      });

      const sdk = makeSdk();

      await expect(
        sdk.reportWithVideo({ ...DEFAULT_OPTIONS, videoBlob: makeVideoBlob() }),
      ).rejects.toThrow('timed out');
    });
  });
});
