'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'agent';
  content: string;
  channel: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SessionState {
  sessionId: string;
  status: string;
  step?: string;
  confidence?: number;
  reason?: string;
}

interface UseAgentSocketReturn {
  isConnected: boolean;
  messages: AgentMessage[];
  agentTyping: boolean;
  sessionState: SessionState | null;
  joinSession: (sessionId: string) => void;
  sendMessage: (sessionId: string, content: string) => void;
  setTyping: (sessionId: string, isTyping: boolean) => void;
  leaveSession: (sessionId: string) => void;
  error: string | null;
}

export function useAgentSocket(): UseAgentSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [agentTyping, setAgentTyping] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    const socket = io(`${API_URL}/agent`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: maxReconnectAttempts,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptRef.current = 0;
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      reconnectAttemptRef.current += 1;
      if (reconnectAttemptRef.current >= maxReconnectAttempts) {
        setError('Unable to connect to the agent service. Please try again later.');
      }
    });

    socket.on('new-message', (data: { sessionId: string; message: AgentMessage }) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
    });

    socket.on('agent-typing', (data: { sessionId: string; isTyping: boolean }) => {
      setAgentTyping(data.isTyping);
    });

    socket.on('session-update', (data: { sessionId: string; state: any }) => {
      setSessionState({
        sessionId: data.sessionId,
        status: data.state?.status || data.state,
        step: data.state?.step,
        confidence: data.state?.confidence,
        reason: data.state?.reason,
      });
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message || 'WebSocket error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinSession = useCallback((sessionId: string) => {
    if (!socketRef.current?.connected) return;
    setMessages([]);
    setAgentTyping(false);
    setSessionState(null);
    socketRef.current.emit('join-session', { sessionId });
  }, []);

  const sendMessage = useCallback((sessionId: string, content: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('send-message', { sessionId, content });
  }, []);

  const setTyping = useCallback((sessionId: string, isTyping: boolean) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('typing', { sessionId, isTyping });
  }, []);

  const leaveSession = useCallback((sessionId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('leave-session', { sessionId });
  }, []);

  return {
    isConnected,
    messages,
    agentTyping,
    sessionState,
    joinSession,
    sendMessage,
    setTyping,
    leaveSession,
    error,
  };
}
