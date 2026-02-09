'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import { agentApi, AgentSession, AgentMessageData } from '@/lib/api/agent';
import { useAgentSocket } from '@/hooks/useAgentSocket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { AgentStatus } from '@/components/chat/AgentStatus';
import { SessionInfo } from '@/components/chat/SessionInfo';
import { EscalationBanner } from '@/components/chat/EscalationBanner';
import { PageLoader, Button } from '@/components/ui';
import type { Ticket } from '@/lib/types/ticket';

export default function AgentChatPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const { isLoading: authLoading } = useRequireAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [allMessages, setAllMessages] = useState<AgentMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Merge socket messages into allMessages, avoiding duplicates
  useEffect(() => {
    if (socketMessages.length === 0) return;
    setAllMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMessages = socketMessages.filter((m) => !existingIds.has(m.id));
      if (newMessages.length === 0) return prev;
      return [...prev, ...newMessages];
    });
  }, [socketMessages]);

  // Update session state from socket updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessionState) {
      setSession((prev) =>
        prev ? { ...prev, status: sessionState.status } : prev
      );
    }
  }, [sessionState]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, agentTyping]);

  // Fetch ticket and check for existing session
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const ticketData = await ticketsApi.getTicket(ticketId);
      setTicket(ticketData);

      // Check if there is an existing agent session via the ticket data
      if (ticketData.agentSessions && ticketData.agentSessions.length > 0) {
        const latestSession = ticketData.agentSessions[ticketData.agentSessions.length - 1]!;
        const sessionData = await agentApi.getSession(latestSession.id);
        setSession(sessionData);
        setAllMessages(sessionData.messages || []);
      } else if (ticketData.agentSession) {
        const sessionData = await agentApi.getSession(ticketData.agentSession.id);
        setSession(sessionData);
        setAllMessages(sessionData.messages || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket data');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  // Join WebSocket room when session is available and socket is connected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (session && isConnected) {
      joinSession(session.id);
      return () => {
        leaveSession(session.id);
      };
    }
  }, [session?.id, isConnected, joinSession, leaveSession]);

  const handleStartSession = async () => {
    try {
      setIsStarting(true);
      setError(null);
      const newSession = await agentApi.startSession(ticketId);
      // Fetch full session with messages
      const sessionData = await agentApi.getSession(newSession.id);
      setSession(sessionData);
      setAllMessages(sessionData.messages || []);
    } catch (err: any) {
      setError(err.message || 'Failed to start AI session');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!session) return;

    if (isConnected) {
      socketSendMessage(session.id, content);
    } else {
      // Fallback to REST API
      agentApi
        .sendMessage(session.id, content)
        .then((agentMsg) => {
          setAllMessages((prev) => [...prev, agentMsg]);
        })
        .catch((err) => {
          setError(err.message || 'Failed to send message');
        });
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (session && isConnected) {
      setTyping(session.id, isTyping);
    }
  };

  const currentStatus = sessionState?.status || session?.status || 'waiting';
  const isEscalated = currentStatus === 'escalated';

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex-shrink-0 mb-4">
          <Link
            href={`/dashboard/tickets/${ticketId}`}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-3"
          >
            &larr; Back to ticket
          </Link>

          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {ticket?.title || 'Ticket'}
              </h1>
              {session && (
                <div className="mt-1">
                  <AgentStatus state={currentStatus} isTyping={agentTyping} />
                </div>
              )}
            </div>

            {!isConnected && session && (
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                Reconnecting...
              </span>
            )}
          </div>
        </div>

        {/* Escalation Banner with assign-to dropdown */}
        {isEscalated && (
          <div className="flex-shrink-0 mb-3">
            <EscalationBanner
              ticketId={ticketId}
              reason={session?.escalationReason || sessionState?.reason}
              escalatedTo={session?.escalatedTo}
            />
          </div>
        )}

        {/* Error State */}
        {(error || socketError) && (
          <div className="flex-shrink-0 mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error || socketError}</p>
          </div>
        )}

        {/* Main content: Chat + Sidebar */}
        {session ? (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Chat column */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-white rounded-t-lg border border-b-0 border-gray-200 p-4">
                {allMessages.length === 0 && !agentTyping && (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm">The AI agent is analyzing your ticket...</p>
                      <p className="text-xs mt-1">Messages will appear here shortly.</p>
                    </div>
                  </div>
                )}

                {allMessages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.createdAt}
                  />
                ))}

                {/* Typing indicator */}
                {agentTyping && (
                  <div className="flex justify-start mb-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white mr-3">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 7H7v6h6V7z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex space-x-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 rounded-b-lg border border-t-0 border-gray-200 overflow-hidden">
                <ChatInput
                  onSend={handleSendMessage}
                  onTyping={handleTyping}
                  disabled={isEscalated}
                  placeholder={
                    isEscalated
                      ? 'This session has been escalated to human support.'
                      : 'Type your message...'
                  }
                />
              </div>
            </div>

            {/* Sidebar - ticket context summary */}
            <div className="hidden lg:block w-72 flex-shrink-0">
              <SessionInfo
                ticket={session.ticket}
                sessionCreatedAt={session.createdAt}
                messageCount={allMessages.length}
              />
            </div>
          </div>
        ) : (
          /* Empty state - no session */
          <div className="flex-1 flex items-center justify-center bg-white rounded-lg border border-gray-200">
            <div className="text-center px-6 py-12">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5a2.25 2.25 0 010 3l-3.1 3.1a2.25 2.25 0 01-3 0L10.5 17.4a2.25 2.25 0 010-3l3.1-3.1a2.25 2.25 0 013 0z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start AI Analysis
              </h3>
              <p className="text-gray-500 mb-6 max-w-sm">
                Let the AI agent analyze this ticket and provide insights, suggested solutions, and help troubleshoot the issue.
              </p>
              <Button
                onClick={handleStartSession}
                isLoading={isStarting}
                disabled={isStarting}
              >
                Start AI Analysis
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
