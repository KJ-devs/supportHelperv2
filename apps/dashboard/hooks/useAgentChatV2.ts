'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';
import {
  createAgentSession,
  getTicketSession,
  sendAgentMessage,
  getAgentMessages,
  type AgentMessageRecord,
} from '@/lib/api/agent-v2';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UseAgentChatV2Return {
  messages: AgentMessageRecord[];
  sessionId: string | null;
  isLoading: boolean;
  isAgentThinking: boolean;
  isNewSession: boolean;
  sendMessage: (content: string) => Promise<void>;
  toolActivity: string[];
  error: string | null;
  setError: (error: string | null) => void;
  reinitialize: () => void;
}

export function useAgentChatV2(ticketId: string): UseAgentChatV2Return {
  const [messages, setMessages] = useState<AgentMessageRecord[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [isNewSession, setIsNewSession] = useState(false);
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initCounter, setInitCounter] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const autoAnalysisTriggered = useRef(false);
  const sendMessageRef = useRef<((content: string) => Promise<void>) | null>(null);

  const reinitialize = useCallback(() => {
    setError(null);
    setMessages([]);
    setSessionId(null);
    sessionIdRef.current = null;
    autoAnalysisTriggered.current = false;
    setInitCounter(c => c + 1);
  }, []);

  // Initialize session and load messages
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setIsLoading(true);

        // Try to reuse existing session first
        let resolvedSessionId: string;
        const existingSession = await getTicketSession(ticketId);
        if (cancelled) return;

        if (existingSession) {
          resolvedSessionId = existingSession.sessionId;
          setIsNewSession(false);
        } else {
          const newSession = await createAgentSession(ticketId);
          if (cancelled) return;
          resolvedSessionId = newSession.sessionId;
          setIsNewSession(true);
        }

        setSessionId(resolvedSessionId);
        sessionIdRef.current = resolvedSessionId;

        const existingMessages = await getAgentMessages(resolvedSessionId);
        if (cancelled) return;

        setMessages(existingMessages);
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to initialize agent session';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [ticketId, initCounter]);

  // Set up WebSocket connection
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket = io(`${API_URL}/agent-v2`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('agent:message', (data: AgentMessageRecord) => {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setIsAgentThinking(false);
    });

    socket.on('agent:tool_call', (data: { toolName: string }) => {
      setToolActivity(prev => [...prev.slice(-4), data.toolName]);
    });

    socket.on('agent:typing', (data: { isTyping: boolean }) => {
      setIsAgentThinking(data.isTyping);
      if (!data.isTyping) {
        setToolActivity([]);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!sessionIdRef.current) return;

    const optimisticMessage: AgentMessageRecord = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setIsAgentThinking(true);

    try {
      const response = await sendAgentMessage(sessionIdRef.current, content);
      const assistantMessage: AgentMessageRecord = {
        id: `response-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        toolsUsed: response.toolsUsed,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
    } finally {
      setIsAgentThinking(false);
      setToolActivity([]);
    }
  }, []);

  // Keep sendMessageRef in sync so the auto-analysis effect can call it without a stale closure
  sendMessageRef.current = sendMessage;

  // Auto-analysis on first launch for new sessions with no messages
  useEffect(() => {
    if (
      !isLoading &&
      isNewSession &&
      sessionId &&
      messages.length === 0 &&
      !autoAnalysisTriggered.current &&
      sendMessageRef.current
    ) {
      autoAnalysisTriggered.current = true;
      sendMessageRef.current(
        'Please analyze this ticket thoroughly and provide your diagnosis, including root cause, affected files, confidence level, and suggested fix.'
      );
    }
  }, [sessionId, isLoading, isNewSession, messages.length]);

  return {
    messages,
    sessionId,
    isLoading,
    isAgentThinking,
    isNewSession,
    sendMessage,
    toolActivity,
    error,
    setError,
    reinitialize,
  };
}
