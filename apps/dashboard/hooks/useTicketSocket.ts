'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';
import type { Ticket } from '@/lib/types/ticket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type TicketEventType =
  | 'ticket:created'
  | 'ticket:updated'
  | 'ticket:assigned'
  | 'ticket:deleted'
  | 'ticket:ai-analysis-completed'
  | 'ticket:bulk-updated';

export interface TicketEvent {
  event: TicketEventType;
  ticket: Partial<Ticket> & { id: string };
  timestamp: string;
}

export interface AgentEscalatedToN2Event {
  event: 'agent:escalated-to-n2';
  ticketId: string;
  sessionId: string;
  n1Summary: string;
  timestamp: string;
}

interface UseTicketSocketReturn {
  isConnected: boolean;
  lastEvent: TicketEvent | null;
  error: string | null;
}

export function useTicketSocket(
  onEvent?: (event: TicketEvent) => void,
  onAgentEscalatedToN2?: (event: AgentEscalatedToN2Event) => void,
): UseTicketSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  const onAgentEscalatedToN2Ref = useRef(onAgentEscalatedToN2);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TicketEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep callback refs up-to-date without re-triggering effect
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onAgentEscalatedToN2Ref.current = onAgentEscalatedToN2;
  }, [onAgentEscalatedToN2]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    const socket = io(`${API_URL}/tickets`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      // Join tenant room on connect (tenantId is derived from JWT on the server)
      socket.emit('join-tenant', {});
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setError('Unable to connect to real-time ticket updates');
    });

    // The 'reconnect' event fires on the manager after a successful reconnection.
    // socket.on('connect') also fires afterward, but this handler makes the
    // error-clearing intent explicit for the reconnection path.
    socket.io.on('reconnect', () => {
      setError(null);
    });

    socket.io.on('reconnect_failed', () => {
      setError('Real-time connection lost. Please refresh the page.');
    });

    const handleEvent = (data: TicketEvent) => {
      setLastEvent(data);
      onEventRef.current?.(data);
    };

    socket.on('ticket:created', handleEvent);
    socket.on('ticket:updated', handleEvent);
    socket.on('ticket:assigned', handleEvent);
    socket.on('ticket:deleted', handleEvent);
    socket.on('ticket:ai-analysis-completed', handleEvent);
    socket.on('ticket:bulk-updated', handleEvent);

    socket.on('agent:escalated-to-n2', (data: AgentEscalatedToN2Event) => {
      onAgentEscalatedToN2Ref.current?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { isConnected, lastEvent, error };
}
