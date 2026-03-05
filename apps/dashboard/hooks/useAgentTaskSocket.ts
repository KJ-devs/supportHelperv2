'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';
import type { ExecutionLogEntry } from '@/lib/api/agent-tasks';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UseAgentTaskSocketOptions {
  onStatusChange?: (taskId: string, newStatus: string) => void;
  onLogAppended?: (entry: ExecutionLogEntry) => void;
  onPlanReady?: (plan: unknown) => void;
  onError?: (error: string) => void;
}

export interface UseAgentTaskSocketReturn {
  isConnected: boolean;
}

/**
 * Connects to the /agent-tasks WebSocket namespace, joins the room for a
 * specific task, and dispatches real-time updates to the provided callbacks.
 */
export function useAgentTaskSocket(
  taskId: string | null,
  options: UseAgentTaskSocketOptions
): UseAgentTaskSocketReturn {
  const [isConnected, setIsConnected] = useState(false);

  // Keep callback refs up-to-date without re-triggering effect
  const onStatusChangeRef = useRef(options.onStatusChange);
  const onLogAppendedRef = useRef(options.onLogAppended);
  const onPlanReadyRef = useRef(options.onPlanReady);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onStatusChangeRef.current = options.onStatusChange;
  }, [options.onStatusChange]);

  useEffect(() => {
    onLogAppendedRef.current = options.onLogAppended;
  }, [options.onLogAppended]);

  useEffect(() => {
    onPlanReadyRef.current = options.onPlanReady;
  }, [options.onPlanReady]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    if (!taskId) return;

    const token = getAuthToken();
    if (!token) return;

    const socket: Socket = io(`${API_URL}/agent-tasks`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 10,
    });

    const joinRoom = () => {
      socket.emit('task:join', { taskId });
    };

    socket.on('connect', () => {
      setIsConnected(true);
      joinRoom();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      console.warn('[useAgentTaskSocket] WebSocket connection error');
    });

    socket.on('task:status-changed', (data: { taskId: string; newStatus: string }) => {
      onStatusChangeRef.current?.(data.taskId, data.newStatus);
    });

    socket.on('task:log-appended', (entry: ExecutionLogEntry) => {
      onLogAppendedRef.current?.(entry);
    });

    socket.on('task:plan-ready', (plan: unknown) => {
      onPlanReadyRef.current?.(plan);
    });

    socket.on('task:error', (data: { message: string } | string) => {
      const message = typeof data === 'string' ? data : data.message;
      onErrorRef.current?.(message);
    });

    return () => {
      socket.emit('task:leave', { taskId });
      socket.disconnect();
    };
  }, [taskId]);

  return { isConnected };
}
