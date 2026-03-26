import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkCapture } from '../src/context/network-capture';

const API_URL = 'https://api.support-helper.io/api/sdk/tickets';

// Save originals before any test modifies them
const nativeFetch = global.fetch;

beforeEach(() => {
  NetworkCapture.uninstall();
  NetworkCapture.clear();
  // Restore native fetch so each test starts clean
  global.fetch = nativeFetch;
});

afterEach(() => {
  NetworkCapture.uninstall();
  NetworkCapture.clear();
  global.fetch = nativeFetch;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body = '', statusText = ''): void {
  global.fetch = vi
    .fn()
    .mockResolvedValue(new Response(body, { status, statusText: statusText || String(status) }));
}

function mockFetchThrow(error: Error): void {
  global.fetch = vi.fn().mockRejectedValue(error);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NetworkCapture', () => {
  describe('fetch status-based capture', () => {
    it('captures a 500 response', async () => {
      mockFetch(500, 'internal error', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/api').catch(() => undefined);

      const entries = NetworkCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe(500);
      expect(entries[0].statusText).toBe('Internal Server Error');
      expect(entries[0].type).toBe('fetch');
    });

    it('captures a 404 response', async () => {
      mockFetch(404, 'not found', 'Not Found');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/missing');

      const entries = NetworkCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe(404);
    });

    it('does NOT capture a 200 response', async () => {
      mockFetch(200, 'ok', 'OK');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/ok');

      expect(NetworkCapture.getEntries()).toHaveLength(0);
    });

    it('does NOT capture a 301 redirect response', async () => {
      mockFetch(301, '', 'Moved Permanently');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/redirect');

      expect(NetworkCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('network errors', () => {
    it('captures a TypeError (network error) with status 0', async () => {
      mockFetchThrow(new TypeError('Failed to fetch'));
      NetworkCapture.install(API_URL);

      await expect(fetch('https://example.com/fail')).rejects.toThrow('Failed to fetch');

      const entries = NetworkCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe(0);
      expect(entries[0].statusText).toBe('Network Error');
      expect(entries[0].type).toBe('fetch');
    });

    it('rethrows the original error after capturing', async () => {
      const err = new TypeError('net::ERR_CONNECTION_REFUSED');
      mockFetchThrow(err);
      NetworkCapture.install(API_URL);

      await expect(fetch('https://example.com/fail')).rejects.toBe(err);
    });
  });

  describe('URL sanitization', () => {
    it('replaces query params with [REDACTED]', async () => {
      mockFetch(500, 'err', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/search?q=secret&token=abc123');

      const entries = NetworkCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].url).not.toContain('secret');
      expect(entries[0].url).not.toContain('abc123');
      expect(entries[0].url).toContain('[REDACTED]');
    });

    it('keeps URLs without query params unchanged (besides normalisation)', async () => {
      mockFetch(500, 'err', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/api/data');

      const entries = NetworkCapture.getEntries();
      expect(entries[0].url).not.toContain('[REDACTED]');
      expect(entries[0].url).toContain('/api/data');
    });
  });

  describe('own API URL exclusion', () => {
    it('does not capture requests to the SDK own API URL', async () => {
      const passthrough = vi.fn().mockResolvedValue(new Response('ok', { status: 500 }));
      global.fetch = passthrough;
      NetworkCapture.install(API_URL);

      // Request to our own API — should be excluded even though status is 500
      await fetch(API_URL).catch(() => undefined);

      // The call went through (passthrough called) but nothing was captured
      expect(passthrough).toHaveBeenCalled();
      expect(NetworkCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('ring buffer', () => {
    it('keeps at most 20 entries', async () => {
      // Install with a single stable mock so the captured original is our vi.fn()
      let callIndex = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve(new Response(`err${callIndex++}`, { status: 500 }));
      });
      NetworkCapture.install(API_URL);

      for (let i = 0; i < 25; i++) {
        await fetch(`https://example.com/api/${i}`);
      }

      expect(NetworkCapture.getEntries()).toHaveLength(20);
    });
  });

  describe('duration', () => {
    it('captures a non-negative duration in milliseconds', async () => {
      mockFetch(500, 'err', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/slow');

      const { duration } = NetworkCapture.getEntries()[0];
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(typeof duration).toBe('number');
    });
  });

  describe('response snippet', () => {
    it('includes the first 200 chars of the response body', async () => {
      const longBody = 'x'.repeat(300);
      mockFetch(500, longBody, 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/large-error');

      const { responseSnippet } = NetworkCapture.getEntries()[0];
      expect(responseSnippet).toHaveLength(200);
      expect(responseSnippet).toBe('x'.repeat(200));
    });

    it('includes full body when shorter than 200 chars', async () => {
      mockFetch(404, 'not found', 'Not Found');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/missing');

      const { responseSnippet } = NetworkCapture.getEntries()[0];
      expect(responseSnippet).toBe('not found');
    });
  });

  describe('timestamp', () => {
    it('has an ISO 8601 timestamp', async () => {
      mockFetch(500, '', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/ts-check');

      const { timestamp } = NetworkCapture.getEntries()[0];
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('method capture', () => {
    it('captures the HTTP method', async () => {
      mockFetch(500, '', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/api', { method: 'POST' });

      expect(NetworkCapture.getEntries()[0].method).toBe('POST');
    });

    it('defaults to GET when no method is provided', async () => {
      mockFetch(500, '', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/api');

      expect(NetworkCapture.getEntries()[0].method).toBe('GET');
    });
  });

  describe('install / uninstall', () => {
    it('is idempotent: installing twice still only patches fetch once', async () => {
      mockFetch(500, 'err', 'Internal Server Error');
      NetworkCapture.install(API_URL);
      NetworkCapture.install(API_URL); // second install should be a no-op

      await fetch('https://example.com/api');

      expect(NetworkCapture.getEntries()).toHaveLength(1);
    });

    it('restores original fetch after uninstall', () => {
      const originalFetch = global.fetch;
      NetworkCapture.install(API_URL);
      expect(global.fetch).not.toBe(originalFetch);

      NetworkCapture.uninstall();
      expect(global.fetch).toBe(originalFetch);
    });

    it('does not capture after uninstall', async () => {
      mockFetch(500, 'err', 'Internal Server Error');
      NetworkCapture.install(API_URL);
      NetworkCapture.uninstall();

      // fetch is now the mock directly (not wrapped)
      await global.fetch('https://example.com/api').catch(() => undefined);

      expect(NetworkCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('empties the buffer', async () => {
      mockFetch(500, '', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/api');
      expect(NetworkCapture.getEntries()).toHaveLength(1);

      NetworkCapture.clear();
      expect(NetworkCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('getEntries', () => {
    it('returns a copy — mutating it does not affect internal state', async () => {
      mockFetch(500, '', 'Internal Server Error');
      NetworkCapture.install(API_URL);

      await fetch('https://example.com/api');
      const entries = NetworkCapture.getEntries();
      entries.splice(0, 1);

      expect(NetworkCapture.getEntries()).toHaveLength(1);
    });
  });

  describe('XHR capture', () => {
    it('captures an XHR 500 response', async () => {
      NetworkCapture.install(API_URL);

      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://example.com/xhr-fail');
        xhr.addEventListener('loadend', () => resolve());
        xhr.send();

        // Simulate load with status 500
        Object.defineProperty(xhr, 'status', { value: 500, configurable: true });
        Object.defineProperty(xhr, 'statusText', {
          value: 'Internal Server Error',
          configurable: true,
        });
        Object.defineProperty(xhr, 'responseText', { value: 'xhr error body', configurable: true });
        xhr.dispatchEvent(new Event('load'));
        resolve();
      });

      const entries = NetworkCapture.getEntries();
      const xhrEntry = entries.find(e => e.type === 'xhr');
      expect(xhrEntry).toBeDefined();
      expect(xhrEntry?.status).toBe(500);
      expect(xhrEntry?.method).toBe('GET');
    });

    it('does not capture XHR 200 response', async () => {
      NetworkCapture.install(API_URL);

      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://example.com/xhr-ok');
        Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
        Object.defineProperty(xhr, 'statusText', { value: 'OK', configurable: true });
        xhr.dispatchEvent(new Event('load'));
        resolve();
      });

      expect(NetworkCapture.getEntries().filter(e => e.type === 'xhr')).toHaveLength(0);
    });
  });
});
