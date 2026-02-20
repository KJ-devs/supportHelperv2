'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AgentMessage {
  id: string;
  ticketId: string;
  type: 'system' | 'user' | 'agent' | 'diagnosis' | 'action_plan' | 'pr_status';
  content: string;
  sender: string;
  metadata?: Record<string, unknown>;
  actionState?: 'pending' | 'approved' | 'rejected' | null;
  createdAt: string;
  replies?: AgentMessage[];
  _count?: { replies: number };
}

interface UseAgentChatOptions {
  ticketId: string;
  agentTaskId?: string;
  apiUrl?: string;
}

interface UseAgentChatReturn {
  messages: AgentMessage[];
  isLoading: boolean;
  isAgentThinking: boolean;
  taskStatus: string | null;
  sendMessage: (content: string) => Promise<void>;
  approveAction: (messageId: string) => Promise<void>;
  rejectAction: (messageId: string) => Promise<void>;
}

export function useAgentChat({
  ticketId,
  agentTaskId,
  apiUrl,
}: UseAgentChatOptions): UseAgentChatReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/v1/tickets/${ticketId}/messages`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [ticketId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const baseUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const cookieToken = document.cookie.match(/token=([^;]+)/)?.[1];

    const socket = io(`${baseUrl}/agent-tasks`, {
      auth: { token: cookieToken },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    if (agentTaskId) {
      socket.emit('task:join', { taskId: agentTaskId });
    }

    socket.on('task:status-changed', (data: { taskId: string; newStatus: string }) => {
      setTaskStatus(data.newStatus);
    });

    socket.on('task:plan-ready', () => setIsAgentThinking(false));
    socket.on('task:code-ready', () => setIsAgentThinking(false));
    socket.on('task:error', () => setIsAgentThinking(false));

    socket.on('ticket:new-message', (data: { ticketId: string; message: AgentMessage }) => {
      if (data.ticketId === ticketId) {
        setMessages((prev: AgentMessage[]) => [...prev, data.message]);
        setIsAgentThinking(false);
      }
    });

    return () => {
      if (agentTaskId) socket.emit('task:leave', { taskId: agentTaskId });
      socket.disconnect();
    };
  }, [ticketId, agentTaskId, apiUrl]);

  const sendMessage = useCallback(
    async (content: string) => {
      const res = await fetch(`/api/v1/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, type: 'user' }),
      });
      if (res.ok) {
        const message = (await res.json()) as AgentMessage;
        setMessages((prev: AgentMessage[]) => [...prev, message]);
        setIsAgentThinking(true);
      }
    },
    [ticketId]
  );

  const approveAction = useCallback(
    async (messageId: string) => {
      const res = await fetch(`/api/v1/tickets/${ticketId}/messages/${messageId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionState: 'approved' }),
      });
      if (res.ok) {
        setMessages((prev: AgentMessage[]) =>
          prev.map((m: AgentMessage) =>
            m.id === messageId ? { ...m, actionState: 'approved' as const } : m
          )
        );
      }
    },
    [ticketId]
  );

  const rejectAction = useCallback(
    async (messageId: string) => {
      const res = await fetch(`/api/v1/tickets/${ticketId}/messages/${messageId}/action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionState: 'rejected' }),
      });
      if (res.ok) {
        setMessages((prev: AgentMessage[]) =>
          prev.map((m: AgentMessage) =>
            m.id === messageId ? { ...m, actionState: 'rejected' as const } : m
          )
        );
      }
    },
    [ticketId]
  );

  return {
    messages,
    isLoading,
    isAgentThinking,
    taskStatus,
    sendMessage,
    approveAction,
    rejectAction,
  };
}
