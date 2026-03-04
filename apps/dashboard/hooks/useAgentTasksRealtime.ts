'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Connects to the /tickets WebSocket namespace and listens for
 * tenant-wide events that affect agent task state. Calls the provided
 * onUpdate callback whenever a relevant event is received so the caller
 * can refetch data.
 */
export function useAgentTasksRealtime(onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket: Socket = io(`${API_URL}/tickets`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      // Join the tenant broadcast room (tenantId is derived from JWT server-side)
      socket.emit('join-tenant', {});
    });

    socket.on('connect_error', () => {
      console.warn('[useAgentTasksRealtime] WebSocket connection error');
    });

    const handleUpdate = () => {
      onUpdateRef.current();
    };

    // Listen for events that signal agent task state changes
    socket.on('ticket:updated', handleUpdate);
    socket.on('ticket:ai-analysis-completed', handleUpdate);
    socket.on('agent:escalated-to-n2', handleUpdate);
    socket.on('ticket:escalated', handleUpdate);

    return () => {
      socket.emit('leave-tenant', {});
      socket.disconnect();
    };
  }, []);
}
