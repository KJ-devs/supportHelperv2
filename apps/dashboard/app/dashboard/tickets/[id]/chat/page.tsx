'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import { agentApi, AgentSession } from '@/lib/api/agent';
import { useAgentSocket } from '@/hooks/useAgentSocket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AgentChat } from '@/components/agent/AgentChat';
import { AgentStateIndicator } from '@/components/agent/AgentStateIndicator';
import { EscalationBanner } from '@/components/chat/EscalationBanner';
import { SessionInfo } from '@/components/chat/SessionInfo';
import { PageLoader } from '@/components/ui';
import type { Ticket } from '@/lib/types/ticket';

export default function AgentChatPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const { isLoading: authLoading } = useRequireAuth();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We still mount the socket hook here so the page header can reflect
  // connection status and the session state badge.
  const { isConnected, sessionState, error: socketError } = useAgentSocket();

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const ticketData = await ticketsApi.getTicket(ticketId);
      setTicket(ticketData);

      // Check for an existing agent session attached to the ticket
      if (ticketData.agentSessions && ticketData.agentSessions.length > 0) {
        const latestSession =
          ticketData.agentSessions[ticketData.agentSessions.length - 1]!;
        const sessionData = await agentApi.getSession(latestSession.id);
        setSession(sessionData);
      } else if (ticketData.agentSession) {
        const sessionData = await agentApi.getSession(ticketData.agentSession.id);
        setSession(sessionData);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load ticket data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  // ------------------------------------------------------------------
  // Session state updates from the socket
  // ------------------------------------------------------------------

  useEffect(() => {
    if (sessionState) {
      setSession((prev) =>
        prev
          ? { ...prev, status: sessionState.status as AgentSession['status'] }
          : prev
      );
    }
  }, [sessionState]);

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const currentStatus = sessionState?.status ?? session?.status ?? 'waiting';
  const isEscalated = currentStatus === 'escalated';

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        {/* ---- Page header ---- */}
        <div className="flex-shrink-0 mb-4">
          <Link
            href={`/dashboard/tickets/${ticketId}`}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to ticket
          </Link>

          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {ticket?.title ?? 'AI Agent Chat'}
              </h1>

              {/* Session state badge shown in the header only when a session exists */}
              {session && (
                <div className="mt-1.5">
                  <AgentStateIndicator
                    state={currentStatus}
                    variant="dot"
                  />
                </div>
              )}
            </div>

            {/* WebSocket connection indicator */}
            <div className="flex-shrink-0 ml-3">
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <Wifi className="w-3.5 h-3.5" />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-1 rounded">
                  <WifiOff className="w-3.5 h-3.5" />
                  Reconnecting...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ---- Page-level error ---- */}
        {(error ?? socketError) && (
          <div className="flex-shrink-0 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
            <p className="text-sm text-red-700 dark:text-red-300">
              {error ?? socketError}
            </p>
          </div>
        )}

        {/* ---- Escalation banner (with team-member assignment) ---- */}
        {isEscalated && session && (
          <div className="flex-shrink-0 mb-3">
            <EscalationBanner
              ticketId={ticketId}
              reason={session.escalationReason ?? sessionState?.reason}
              escalatedTo={session.escalatedTo}
            />
          </div>
        )}

        {/* ---- Main layout: chat + sidebar ---- */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Chat column — AgentChat owns all socket/API logic */}
          <div className="flex-1 min-w-0 flex flex-col">
            <AgentChat
              ticketId={ticketId}
              initialSession={session}
              onSessionStarted={(newSession) => {
                setSession(newSession);
              }}
            />
          </div>

          {/* Sidebar — ticket context */}
          {session && (
            <div className="hidden lg:block w-72 flex-shrink-0">
              <SessionInfo
                ticket={session.ticket}
                sessionCreatedAt={session.createdAt}
                messageCount={session.messages?.length ?? 0}
              />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
