'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '@/lib/api/client';
import {
  createAgentSession,
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
  sendMessage: (content: string) => Promise<void>;
  toolActivity: string[];
  error: string | null;
}

export function useAgentChatV2(ticketId: string): UseAgentChatV2Return {
  const [messages, setMessages] = useState<AgentMessageRecord[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [toolActivity, setToolActivity] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Initialize session and load messages
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setIsLoading(true);
        const session = await createAgentSession(ticketId);
        if (cancelled) return;

        setSessionId(session.sessionId);
        sessionIdRef.current = session.sessionId;

        const existingMessages = await getAgentMessages(session.sessionId);
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
  }, [ticketId]);

  // Set up WebSocket connection
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socket = io(`${API_URL}/agent`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('agent:message', (data: AgentMessageRecord) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setIsAgentThinking(false);
    });

    socket.on('agent:tool_call', (data: { toolName: string }) => {
      setToolActivity((prev) => [...prev.slice(-4), data.toolName]);
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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionIdRef.current) return;

      const optimisticMessage: AgentMessageRecord = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMessage]);
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
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
      } finally {
        setIsAgentThinking(false);
        setToolActivity([]);
      }
    },
    [],
  );

  return {
    messages,
    sessionId,
    isLoading,
    isAgentThinking,
    sendMessage,
    toolActivity,
    error,
  };
}
