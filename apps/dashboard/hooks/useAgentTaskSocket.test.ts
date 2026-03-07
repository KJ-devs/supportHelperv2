/**
 * Tests for useAgentTaskSocket hook
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
import { useAgentTaskSocket } from './useAgentTaskSocket';
import type { ExecutionLogEntry } from '@/lib/api/agent-tasks';

type EventHandler = (...args: unknown[]) => void;

function createMockSocket() {
  const socketHandlers = new Map<string, EventHandler>();

  const socket = {
    on: vi.fn((event: string, handler: EventHandler) => {
      socketHandlers.set(event, handler);
    }),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };

  return { socket, socketHandlers };
}

describe('useAgentTaskSocket', () => {
  let mockSocket: ReturnType<typeof createMockSocket>['socket'];
  let socketHandlers: Map<string, EventHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const created = createMockSocket();
    mockSocket = created.socket;
    socketHandlers = created.socketHandlers;
    vi.mocked(io).mockReturnValue(mockSocket as any);
    vi.mocked(getAuthToken).mockReturnValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial state with isConnected=false', () => {
    const { result } = renderHook(() => useAgentTaskSocket('task-1', {}));
    expect(result.current.isConnected).toBe(false);
  });

  it('does not create a socket when taskId is null', () => {
    renderHook(() => useAgentTaskSocket(null, {}));
    expect(io).not.toHaveBeenCalled();
  });

  it('does not create a socket when no auth token', () => {
    vi.mocked(getAuthToken).mockReturnValue(null);
    renderHook(() => useAgentTaskSocket('task-1', {}));
    expect(io).not.toHaveBeenCalled();
  });

  it('creates socket connection to /agent-tasks namespace', () => {
    renderHook(() => useAgentTaskSocket('task-1', {}));
    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('/agent-tasks'),
      expect.objectContaining({
        auth: { token: 'mock-jwt-token' },
      })
    );
  });

  it('emits task:join with taskId on connect', () => {
    renderHook(() => useAgentTaskSocket('task-abc', {}));

    act(() => {
      socketHandlers.get('connect')?.();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('task:join', { taskId: 'task-abc' });
  });

  it('sets isConnected=true when connect event fires', () => {
    const { result } = renderHook(() => useAgentTaskSocket('task-1', {}));

    act(() => {
      socketHandlers.get('connect')?.();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('sets isConnected=false when disconnect event fires', () => {
    const { result } = renderHook(() => useAgentTaskSocket('task-1', {}));

    act(() => {
      socketHandlers.get('connect')?.();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      socketHandlers.get('disconnect')?.();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('calls onStatusChange when task:status-changed fires', () => {
    const onStatusChange = vi.fn();
    renderHook(() => useAgentTaskSocket('task-1', { onStatusChange }));

    act(() => {
      socketHandlers.get('task:status-changed')?.({
        taskId: 'task-1',
        newStatus: 'plan_ready',
      });
    });

    expect(onStatusChange).toHaveBeenCalledWith('task-1', 'plan_ready');
  });

  it('calls onLogAppended when task:log-appended fires', () => {
    const onLogAppended = vi.fn();
    renderHook(() => useAgentTaskSocket('task-1', { onLogAppended }));

    const entry: ExecutionLogEntry = {
      step: 'analysis_start',
      message: 'Starting analysis',
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      socketHandlers.get('task:log-appended')?.({
        taskId: 'task-1',
        entry,
        timestamp: '2026-01-01T00:00:00Z',
      });
    });

    expect(onLogAppended).toHaveBeenCalledWith(entry);
  });

  it('calls onPlanReady when task:plan-ready fires', () => {
    const onPlanReady = vi.fn();
    renderHook(() => useAgentTaskSocket('task-1', { onPlanReady }));

    const plan = { summary: 'Fix the bug', rootCause: 'null pointer' };

    act(() => {
      socketHandlers.get('task:plan-ready')?.(plan);
    });

    expect(onPlanReady).toHaveBeenCalledWith(plan);
  });

  it('calls onError when task:error fires', () => {
    const onError = vi.fn();
    renderHook(() => useAgentTaskSocket('task-1', { onError }));

    act(() => {
      socketHandlers.get('task:error')?.({ message: 'Something went wrong' });
    });

    expect(onError).toHaveBeenCalledWith('Something went wrong');
  });

  it('disconnects socket on unmount', () => {
    const { unmount } = renderHook(() => useAgentTaskSocket('task-1', {}));
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('emits task:leave before disconnecting on unmount', () => {
    const { unmount } = renderHook(() => useAgentTaskSocket('task-1', {}));
    unmount();
    expect(mockSocket.emit).toHaveBeenCalledWith('task:leave', { taskId: 'task-1' });
  });

  it('configures socket with reconnection options', () => {
    renderHook(() => useAgentTaskSocket('task-1', {}));
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reconnection: true,
      })
    );
  });

  it('re-joins room after reconnect', () => {
    renderHook(() => useAgentTaskSocket('task-xyz', {}));

    // Initial connect
    act(() => {
      socketHandlers.get('connect')?.();
    });

    // Simulate disconnect + reconnect
    act(() => {
      socketHandlers.get('disconnect')?.();
    });
    act(() => {
      socketHandlers.get('connect')?.();
    });

    // Should have emitted task:join twice (once per connect)
    const joinCalls = vi
      .mocked(mockSocket.emit)
      .mock.calls.filter(([event]) => event === 'task:join');
    expect(joinCalls.length).toBe(2);
  });
});
