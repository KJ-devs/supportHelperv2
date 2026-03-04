'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Connects to the /agent-tasks WebSocket namespace and listens for
 * tenant-wide task status changes. Calls the provided onUpdate callback
 * whenever a task event is received so the caller can refetch data.
 */
export function useAgentTasksRealtime(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket: Socket = io(`${API_URL}/agent-tasks`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      // Join the tenant broadcast room so we receive updates for all tasks
      socket.emit('tenant:join');
    });

    const handleUpdate = () => {
      onUpdateRef.current();
    };

    // Listen for all task lifecycle events that could affect the list
    socket.on('task:status-changed', handleUpdate);
    socket.on('task:plan-ready', handleUpdate);
    socket.on('task:code-ready', handleUpdate);
    socket.on('task:pr-created', handleUpdate);
    socket.on('task:ci-status', handleUpdate);
    socket.on('task:error', handleUpdate);

    return () => {
      socket.disconnect();
    };
  }, []);
}
