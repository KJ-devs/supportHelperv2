/**
 * Tests for useTicketSocket hook
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// These mocks must not reference outer variables (hoisting constraint)
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  getAuthToken: vi.fn(),
}));

// Import after mocks are set up
import { io } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';
import { useTicketSocket } from './useTicketSocket';

type EventHandler = (...args: unknown[]) => void;

function createMockSocket() {
  const socketHandlers = new Map<string, EventHandler>();
  const ioHandlers = new Map<string, EventHandler>();

  const socket = {
    on: vi.fn((event: string, handler: EventHandler) => {
      socketHandlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    io: {
      on: vi.fn((event: string, handler: EventHandler) => {
        ioHandlers.set(event, handler);
      }),
      off: vi.fn(),
    },
  };

  return { socket, socketHandlers, ioHandlers };
}

describe('useTicketSocket', () => {
  let mockSocket: ReturnType<typeof createMockSocket>['socket'];
  let socketHandlers: Map<string, EventHandler>;
  let ioHandlers: Map<string, EventHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const created = createMockSocket();
    mockSocket = created.socket;
    socketHandlers = created.socketHandlers;
    ioHandlers = created.ioHandlers;
    vi.mocked(io).mockReturnValue(mockSocket as any);
    vi.mocked(getAuthToken).mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state with isConnected=false, lastEvent=null, error=null', () => {
    const { result } = renderHook(() => useTicketSocket());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.lastEvent).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets error="Not authenticated" when no auth token', () => {
    vi.mocked(getAuthToken).mockReturnValue(null);
    const { result } = renderHook(() => useTicketSocket());
    expect(result.current.error).toBe('Not authenticated');
    expect(result.current.isConnected).toBe(false);
    expect(io).not.toHaveBeenCalled();
  });

  it('creates socket connection with token when auth token exists', () => {
    renderHook(() => useTicketSocket());
    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('/tickets'),
      expect.objectContaining({
        auth: { token: 'mock-jwt-token' },
      })
    );
  });

  it('sets isConnected=true when socket connect event fires', () => {
    const { result } = renderHook(() => useTicketSocket());

    act(() => {
      socketHandlers.get('connect')?.();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('emits join-tenant on connect', () => {
    renderHook(() => useTicketSocket());

    act(() => {
      socketHandlers.get('connect')?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('join-tenant', {});
  });

  it('sets isConnected=false when disconnect event fires', () => {
    const { result } = renderHook(() => useTicketSocket());

    // First connect
    act(() => {
      socketHandlers.get('connect')?.();
    });
    expect(result.current.isConnected).toBe(true);

    // Then disconnect
    act(() => {
      socketHandlers.get('disconnect')?.();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('sets error message when connect_error event fires', () => {
    const { result } = renderHook(() => useTicketSocket());

    act(() => {
      socketHandlers.get('connect_error')?.();
    });

    expect(result.current.error).toBe('Unable to connect to real-time ticket updates');
  });

  it('clears error on reconnect event', () => {
    const { result } = renderHook(() => useTicketSocket());

    // Set an error first
    act(() => {
      socketHandlers.get('connect_error')?.();
    });
    expect(result.current.error).not.toBeNull();

    // Then reconnect
    act(() => {
      ioHandlers.get('reconnect')?.();
    });
    expect(result.current.error).toBeNull();
  });

  it('sets permanent error message on reconnect_failed', () => {
    const { result } = renderHook(() => useTicketSocket());

    act(() => {
      ioHandlers.get('reconnect_failed')?.();
    });

    expect(result.current.error).toBe('Real-time connection lost. Please refresh the page.');
  });

  it('updates lastEvent when ticket:created event fires', () => {
    const { result } = renderHook(() => useTicketSocket());
    const eventData = {
      event: 'ticket:created' as const,
      ticket: { id: 'ticket-1', title: 'New Bug' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:created')?.(eventData);
    });

    expect(result.current.lastEvent).toEqual(eventData);
  });

  it('updates lastEvent when ticket:updated event fires', () => {
    const { result } = renderHook(() => useTicketSocket());
    const eventData = {
      event: 'ticket:updated' as const,
      ticket: { id: 'ticket-2' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:updated')?.(eventData);
    });

    expect(result.current.lastEvent).toEqual(eventData);
  });

  it('updates lastEvent when ticket:assigned event fires', () => {
    const { result } = renderHook(() => useTicketSocket());
    const eventData = {
      event: 'ticket:assigned' as const,
      ticket: { id: 'ticket-3' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:assigned')?.(eventData);
    });

    expect(result.current.lastEvent).toEqual(eventData);
  });

  it('updates lastEvent when ticket:deleted event fires', () => {
    const { result } = renderHook(() => useTicketSocket());
    const eventData = {
      event: 'ticket:deleted' as const,
      ticket: { id: 'ticket-4' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:deleted')?.(eventData);
    });

    expect(result.current.lastEvent).toEqual(eventData);
  });

  it('updates lastEvent when ticket:ai-analysis-completed fires', () => {
    const { result } = renderHook(() => useTicketSocket());
    const eventData = {
      event: 'ticket:ai-analysis-completed' as const,
      ticket: { id: 'ticket-5' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:ai-analysis-completed')?.(eventData);
    });

    expect(result.current.lastEvent).toEqual(eventData);
  });

  it('updates lastEvent when ticket:bulk-updated event fires', () => {
    const { result } = renderHook(() => useTicketSocket());
    const eventData = {
      event: 'ticket:bulk-updated' as const,
      ticket: { id: 'ticket-6' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:bulk-updated')?.(eventData);
    });

    expect(result.current.lastEvent).toEqual(eventData);
  });

  it('calls the onEvent callback when a ticket event fires', () => {
    const onEvent = vi.fn();
    renderHook(() => useTicketSocket(onEvent));
    const eventData = {
      event: 'ticket:created' as const,
      ticket: { id: 'ticket-1' },
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('ticket:created')?.(eventData);
    });

    expect(onEvent).toHaveBeenCalledWith(eventData);
  });

  it('disconnects socket on unmount', () => {
    const { unmount } = renderHook(() => useTicketSocket());
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('configures socket with reconnection options', () => {
    renderHook(() => useTicketSocket());
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reconnection: true,
        reconnectionAttempts: 10,
      })
    );
  });

  it('registers listeners for all 6 ticket event types', () => {
    renderHook(() => useTicketSocket());

    const expectedEvents = [
      'ticket:created',
      'ticket:updated',
      'ticket:assigned',
      'ticket:deleted',
      'ticket:ai-analysis-completed',
      'ticket:bulk-updated',
    ];

    for (const event of expectedEvents) {
      expect(socketHandlers.has(event)).toBe(true);
    }
  });
});
