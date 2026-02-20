'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
} from 'react';
import { Bot, User, Send, MessageSquare, AlertTriangle } from 'lucide-react';
import { agentApi, AgentSession, AgentMessageData } from '@/lib/api/agent';
import { useAgentSocket } from '@/hooks/useAgentSocket';
import { AgentStateIndicator } from '@/components/agent/AgentStateIndicator';
import { Button } from '@/components/ui';
import { Skeleton } from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentChatProps {
  /** The ticket ID used to start a new agent session if one does not exist. */
  ticketId: string;
  /**
   * Optional pre-loaded session. When provided the component will skip the
   * "Start AI Analysis" empty state and go straight to the chat view.
   */
  initialSession?: AgentSession | null;
  /**
   * Called after a new session is successfully started so the parent can
   * update its own state (e.g. refresh the ticket data).
   */
  onSessionStarted?: (session: AgentSession) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isAgent = role === 'agent';

  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`flex items-start max-w-[78%] ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${
            isAgent
              ? 'bg-gray-600 dark:bg-gray-500 mr-3'
              : 'bg-blue-600 dark:bg-blue-500 ml-3'
          }`}
        >
          {isAgent ? (
            <Bot className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>

        {/* Bubble */}
        <div className="min-w-0">
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isAgent
                ? 'bg-gray-100 text-gray-900 rounded-tl-sm dark:bg-gray-800 dark:text-gray-100'
                : 'bg-blue-600 text-white rounded-tr-sm dark:bg-blue-500'
            }`}
          >
            {content}
          </div>
          <p
            className={`text-xs text-gray-400 dark:text-gray-500 mt-1 ${
              isAgent ? 'text-left' : 'text-right'
            }`}
          >
            {formatTimestamp(timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 dark:bg-gray-500 flex items-center justify-center text-white mr-3">
          <Bot className="w-4 h-4" />
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="flex space-x-1 items-center h-4">
            <span
              className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4 animate-pulse">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-700 p-4 space-y-4 animate-pulse">
        {/* Agent message */}
        <div className="flex justify-start">
          <div className="flex items-start">
            <Skeleton className="w-8 h-8 rounded-full mr-3 flex-shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-10 w-48 rounded-2xl" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
        {/* User message */}
        <div className="flex justify-end">
          <div className="flex items-start flex-row-reverse">
            <Skeleton className="w-8 h-8 rounded-full ml-3 flex-shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-8 w-36 rounded-2xl" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          </div>
        </div>
        {/* Agent message 2 */}
        <div className="flex justify-start">
          <div className="flex items-start">
            <Skeleton className="w-8 h-8 rounded-full mr-3 flex-shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-16 w-64 rounded-2xl" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="flex-shrink-0 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 p-3">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat input (inline, no separate file needed)
// ---------------------------------------------------------------------------

const MAX_CHARS = 2000;

interface ChatInputAreaProps {
  onSend: (content: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

function ChatInputArea({
  onSend,
  onTypingChange,
  disabled = false,
  placeholder = 'Type your message...',
}: ChatInputAreaProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || trimmed.length > MAX_CHARS) return;
    onSend(trimmed);
    setValue('');
    onTypingChange?.(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [value, disabled, onSend, onTypingChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (val: string) => {
    if (val.length > MAX_CHARS) return;
    setValue(val);

    if (onTypingChange) {
      onTypingChange(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTypingChange(false);
        typingTimeoutRef.current = null;
      }, 2000);
    }
  };

  const charCount = value.length;
  const isNearLimit = charCount > MAX_CHARS * 0.9;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <div className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-2.5 pr-24 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800/50 max-h-40"
          />
          <div className="absolute right-3 bottom-2 flex items-center space-x-2">
            <span
              className={`text-xs ${
                isNearLimit
                  ? 'text-red-500 font-medium'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {charCount}/{MAX_CHARS}
            </span>
            <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Ctrl+Enter
            </span>
          </div>
        </div>
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim() || charCount > MAX_CHARS}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Send message (Ctrl+Enter)"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — no session yet
// ---------------------------------------------------------------------------

interface EmptySessionStateProps {
  onStart: () => void;
  isStarting: boolean;
}

function EmptySessionState({ onStart, isStarting }: EmptySessionStateProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-14 text-center">
      <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Start AI Analysis
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
        Let the AI agent analyze this ticket, propose solutions, and help
        troubleshoot the issue through an interactive conversation.
      </p>
      <Button onClick={onStart} isLoading={isStarting} disabled={isStarting}>
        Start AI Analysis
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty messages state — session exists but no messages yet
// ---------------------------------------------------------------------------

function EmptyMessagesState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
      <MessageSquare className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-medium">The AI agent is analyzing your ticket...</p>
      <p className="text-xs mt-1">Messages will appear here shortly.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentChat({
  ticketId,
  initialSession = null,
  onSessionStarted,
}: AgentChatProps) {
  const [session, setSession] = useState<AgentSession | null>(initialSession);
  const [allMessages, setAllMessages] = useState<AgentMessageData[]>(
    initialSession?.messages ?? []
  );
  const [isLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    messages: socketMessages,
    agentTyping,
    sessionState,
    joinSession,
    sendMessage: socketSendMessage,
    setTyping,
    leaveSession,
    error: socketError,
  } = useAgentSocket();

  // Keep allMessages in sync with the initial session prop (parent refresh)
  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      setAllMessages(initialSession.messages ?? []);
    }
  }, [initialSession]);

  // Merge incoming socket messages — avoid duplicates
  useEffect(() => {
    if (socketMessages.length === 0) return;
    setAllMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMessages = socketMessages.filter((m) => !existingIds.has(m.id));
      if (newMessages.length === 0) return prev;
      return [...prev, ...newMessages];
    });
  }, [socketMessages]);

  // Reflect session state updates from socket
  useEffect(() => {
    if (sessionState) {
      setSession((prev) =>
        prev ? { ...prev, status: sessionState.status as AgentSession['status'] } : prev
      );
    }
  }, [sessionState]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, agentTyping]);

  // Join / leave WebSocket room
  useEffect(() => {
    if (session && isConnected) {
      joinSession(session.id);
      return () => {
        leaveSession(session.id);
      };
    }
  }, [session, isConnected, joinSession, leaveSession]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleStartSession = async () => {
    try {
      setIsStarting(true);
      setError(null);
      const newSession = await agentApi.startSession(ticketId);
      const fullSession = await agentApi.getSession(newSession.id);
      setSession(fullSession);
      setAllMessages(fullSession.messages ?? []);
      onSessionStarted?.(fullSession);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to start AI session';
      setError(message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!session) return;

      if (isConnected) {
        socketSendMessage(session.id, content);
      } else {
        // Fallback to REST API when WebSocket is unavailable
        agentApi
          .sendMessage(session.id, content)
          .then((msg) => {
            setAllMessages((prev) => [...prev, msg]);
          })
          .catch((err: unknown) => {
            const message =
              err instanceof Error ? err.message : 'Failed to send message';
            setError(message);
          });
      }
    },
    [session, isConnected, socketSendMessage]
  );

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      if (session && isConnected) {
        setTyping(session.id, isTyping);
      }
    },
    [session, isConnected, setTyping]
  );

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const currentStatus = sessionState?.status ?? session?.status ?? 'waiting';
  const isEscalated = currentStatus === 'escalated';
  const combinedError = error ?? socketError;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      {session && (
        <div className="flex-shrink-0 flex items-center justify-between mb-3">
          <AgentStateIndicator
            state={currentStatus}
            isTyping={agentTyping}
            variant="badge"
          />
          {!isConnected && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 rounded">
              Reconnecting...
            </span>
          )}
        </div>
      )}

      {/* Error banner */}
      {combinedError && (
        <div className="flex-shrink-0 mb-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{combinedError}</p>
        </div>
      )}

      {/* Escalation notice */}
      {isEscalated && (
        <div className="flex-shrink-0 mb-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              This ticket has been escalated to human support.
            </p>
            {session?.escalationReason && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                Reason: {session.escalationReason}
              </p>
            )}
          </div>
        </div>
      )}

      {session ? (
        /* ---- Chat view ---- */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-700 p-4">
            {allMessages.length === 0 && !agentTyping ? (
              <EmptyMessagesState />
            ) : (
              <>
                {allMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.createdAt}
                  />
                ))}

                {agentTyping && <TypingIndicator />}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700 overflow-hidden">
            <ChatInputArea
              onSend={handleSendMessage}
              onTypingChange={handleTypingChange}
              disabled={isEscalated}
              placeholder={
                isEscalated
                  ? 'This session has been escalated to human support.'
                  : 'Type your message... (Ctrl+Enter to send)'
              }
            />
          </div>
        </div>
      ) : (
        /* ---- No session yet ---- */
        <EmptySessionState
          onStart={handleStartSession}
          isStarting={isStarting}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
