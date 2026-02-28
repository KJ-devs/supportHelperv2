/**
 * Unit tests for pollTicketStatus() — the AI analysis polling helper.
 *
 * Strategy:
 *   - Use vi.useFakeTimers() so setInterval / setTimeout are synchronous.
 *   - Use vi.advanceTimersByTimeAsync() to move fake time AND flush the
 *     resulting promise microtasks (available in vitest 1.x).
 *   - Mock global.fetch to control server responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pollTicketStatus,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
} from '../src/widget/widget-api';
import type { TicketStatusResponse } from '../src/widget/widget-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'https://api.test';
const SDK_KEY = 'sk_test_key';
const TICKET_ID = 'ticket-uuid-1234';

function makeTicket(overrides: Partial<TicketStatusResponse> = {}): TicketStatusResponse {
  return {
    id: TICKET_ID,
    title: 'Button broken',
    status: 'open',
    aiSummary: null,
    aiAnalysis: null,
    severity: null,
    type: null,
    ...overrides,
  };
}

/** Mock that always responds with a ticket that has no aiSummary yet. */
function pendingFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeTicket()),
  } as Response);
}

/**
 * Flush one round of promises (microtasks).
 * The initial doPoll() call is a void async fire-and-forget, so we need
 * multiple rounds to let fetch + json() + callbacks all settle.
 */
async function flushPromises(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollTicketStatus()', () => {
  // -------------------------------------------------------------------------
  // Basic polling behaviour
  // -------------------------------------------------------------------------

  describe('basic polling', () => {
    it('calls fetch immediately on start', async () => {
      global.fetch = pendingFetch();
      const onResult = vi.fn().mockReturnValue(false);

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });

      // Flush the initial doPoll() microtask chain.
      await flushPromises();

      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it('sends GET request to /api/sdk/tickets/:id with correct headers', async () => {
      global.fetch = pendingFetch();
      const onResult = vi.fn().mockReturnValue(false);

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });
      await flushPromises();

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${API_URL}/api/sdk/tickets/${TICKET_ID}`);
      expect((init.headers as Record<string, string>)['x-sdk-key']).toBe(SDK_KEY);
      expect(init.method).toBe('GET');
    });

    it('calls fetch again after each interval', async () => {
      global.fetch = pendingFetch();
      const onResult = vi.fn().mockReturnValue(false);

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });

      // Initial poll
      await flushPromises();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Advance one interval (advanceTimersByTimeAsync also flushes microtasks)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Advance another interval
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('passes the ticket response to onResult on each successful poll', async () => {
      const ticket = makeTicket({ status: 'analyzing' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(ticket),
      } as Response);

      const onResult = vi.fn().mockReturnValue(false);

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });
      await flushPromises();

      expect(onResult).toHaveBeenCalledWith(ticket);
    });
  });

  // -------------------------------------------------------------------------
  // Stop when onResult returns true
  // -------------------------------------------------------------------------

  describe('stops when results are received', () => {
    it('stops polling when onResult returns true', async () => {
      const ticketWithResult = makeTicket({ aiSummary: 'Video shows a null pointer error.' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(ticketWithResult),
      } as Response);

      const onResult = vi.fn().mockReturnValue(true); // signal done

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });
      await flushPromises();

      // Advance well past one interval — should NOT fetch again
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

      expect(global.fetch).toHaveBeenCalledOnce();
      expect(onResult).toHaveBeenCalledOnce();
    });

    it('does not fire onTimeout after stopping on results', async () => {
      const ticketWithResult = makeTicket({ aiSummary: 'Summary here.' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(ticketWithResult),
      } as Response);

      const onResult = vi.fn().mockReturnValue(true);
      const onTimeout = vi.fn();

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout });
      await flushPromises();

      // Advance past the full timeout duration
      await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + 1000);

      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Timeout behaviour
  // -------------------------------------------------------------------------

  describe('timeout', () => {
    it('calls onTimeout after POLL_TIMEOUT_MS with no results', async () => {
      global.fetch = pendingFetch(); // always returns null aiSummary
      const onResult = vi.fn().mockReturnValue(false);
      const onTimeout = vi.fn();

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout });
      await flushPromises();

      // Advance to just before timeout — onTimeout should NOT have fired
      await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS - 100);
      expect(onTimeout).not.toHaveBeenCalled();

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(200);
      expect(onTimeout).toHaveBeenCalledOnce();
    });

    it('stops fetching after timeout fires', async () => {
      global.fetch = pendingFetch();
      const onResult = vi.fn().mockReturnValue(false);
      const onTimeout = vi.fn();

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout });
      await flushPromises();

      // Fire the timeout
      await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + 1000);

      const callCountAfterTimeout = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      // No additional fetch calls should happen after the timeout
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterTimeout);
    });

    it('respects a custom timeoutMs parameter', async () => {
      global.fetch = pendingFetch();
      const onTimeout = vi.fn();

      const customTimeout = 10_000;
      pollTicketStatus(
        API_URL, SDK_KEY, TICKET_ID,
        { onResult: vi.fn().mockReturnValue(false), onTimeout },
        POLL_INTERVAL_MS,
        customTimeout,
      );
      await flushPromises();

      await vi.advanceTimersByTimeAsync(customTimeout - 100);
      expect(onTimeout).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(200);
      expect(onTimeout).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Manual stop
  // -------------------------------------------------------------------------

  describe('stop()', () => {
    it('cancels polling immediately when stop() is called', async () => {
      global.fetch = pendingFetch();
      const onResult = vi.fn().mockReturnValue(false);

      const { stop } = pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, {
        onResult,
        onTimeout: vi.fn(),
      });

      await flushPromises();
      stop();

      const callCountAfterStop = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      // Advance multiple intervals — should not trigger more fetches
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountAfterStop);
    });

    it('does not fire onTimeout after stop()', async () => {
      global.fetch = pendingFetch();
      const onTimeout = vi.fn();

      const { stop } = pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, {
        onResult: vi.fn().mockReturnValue(false),
        onTimeout,
      });

      await flushPromises();
      stop();

      await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + 1000);
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error resilience
  // -------------------------------------------------------------------------

  describe('error resilience', () => {
    it('continues polling after a network TypeError', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeTicket()),
        } as Response);
      });

      const onResult = vi.fn().mockReturnValue(false);

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });
      await flushPromises();

      // After error on first call — onResult should NOT have been called yet
      expect(onResult).not.toHaveBeenCalled();

      // Advance one interval — second fetch succeeds
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(onResult).toHaveBeenCalledOnce();
    });

    it('continues polling after a non-2xx HTTP response', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 503 } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeTicket()),
        } as Response);
      });

      const onResult = vi.fn().mockReturnValue(false);

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });
      await flushPromises();

      expect(onResult).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(onResult).toHaveBeenCalledOnce();
    });

    it('does not call onResult when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Network failure'));
      const onResult = vi.fn();

      pollTicketStatus(API_URL, SDK_KEY, TICKET_ID, { onResult, onTimeout: vi.fn() });
      await flushPromises();

      expect(onResult).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Custom interval
  // -------------------------------------------------------------------------

  describe('custom intervalMs', () => {
    it('uses the provided intervalMs instead of the default', async () => {
      global.fetch = pendingFetch();
      const onResult = vi.fn().mockReturnValue(false);
      const customInterval = 2000;

      pollTicketStatus(
        API_URL, SDK_KEY, TICKET_ID,
        { onResult, onTimeout: vi.fn() },
        customInterval,
        POLL_TIMEOUT_MS,
      );

      await flushPromises(); // initial poll
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // After one custom interval
      await vi.advanceTimersByTimeAsync(customInterval);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // After another custom interval
      await vi.advanceTimersByTimeAsync(customInterval);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
