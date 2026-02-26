/**
 * Ticket Detail Page
 * Page de détail d'un ticket spécifique
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import { agentApi } from '@/lib/api/agent';
import { getTicketDiagnosis } from '@/lib/api/agent-v2';
import type { Ticket } from '@/lib/types/ticket';
import type { Diagnosis } from '@/components/diagnosis';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { TicketTimeline } from '@/components/tickets/TicketTimeline';
import { DiagnosisPanel } from '@/components/diagnosis';
import { AgentChatV2 } from '@/components/agent-chat';
import { PageLoader, Button } from '@/components/ui';
import { AlertTriangle, Bot, Trash2 } from 'lucide-react';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth();

  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false);
  const [showAgentChat, setShowAgentChat] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ticketsApi.getTicket(ticketId);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du ticket');
      console.error('Error fetching ticket:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  const fetchDiagnosis = useCallback(async () => {
    try {
      setIsDiagnosisLoading(true);
      const data = await getTicketDiagnosis(ticketId);
      setDiagnosis(data);
    } catch (err) {
      console.error('Error fetching diagnosis:', err);
    } finally {
      setIsDiagnosisLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading && ticketId) {
      fetchTicket();
      fetchDiagnosis();
    }
  }, [ticketId, authLoading, fetchTicket, fetchDiagnosis]);

  const handleUpdate = (updatedTicket: Ticket) => {
    setTicket(updatedTicket);
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce ticket ?')) {
      return;
    }

    try {
      await ticketsApi.deleteTicket(ticketId);
      router.push('/dashboard/tickets');
    } catch (error) {
      alert('Erreur lors de la suppression du ticket');
      console.error('Error deleting ticket:', error);
    }
  };

  const [isAgentLoading, setIsAgentLoading] = useState(false);

  const handleOpenAgent = useCallback(async () => {
    if (!ticket) return;

    // If a session already exists on the ticket, navigate directly
    const existingSession =
      ticket.agentSession ??
      (ticket.agentSessions && ticket.agentSessions.length > 0
        ? ticket.agentSessions[0]
        : null);

    if (existingSession) {
      router.push(`/dashboard/tickets/${ticketId}/chat`);
      return;
    }

    // Otherwise start a new session then navigate
    try {
      setIsAgentLoading(true);
      await agentApi.startSession(ticketId);
      router.push(`/dashboard/tickets/${ticketId}/chat`);
    } catch (err) {
      console.error('Error starting agent session:', err);
      alert('Erreur lors du démarrage de la session IA');
    } finally {
      setIsAgentLoading(false);
    }
  }, [ticket, ticketId, router]);

  const handleAskAgent = useCallback(() => {
    setShowAgentChat(true);
  }, []);

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/tickets"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Retour aux tickets
          </Link>

          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Détails du ticket</h1>

            {ticket && (
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchTicket}
                >
                  🔄 Actualiser
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenAgent}
                  isLoading={isAgentLoading}
                  disabled={isAgentLoading || ticket.status === 'resolved' || ticket.status === 'closed'}
                  className="flex items-center gap-1"
                >
                  <Bot className="w-4 h-4" aria-hidden="true" />
                  Agent IA
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  Supprimer
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-600 dark:text-red-400" aria-hidden="true" />
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Erreur</h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <div className="flex justify-center space-x-2">
              <Button variant="secondary" size="sm" onClick={fetchTicket}>
                Réessayer
              </Button>
              <Link href="/dashboard/tickets">
                <Button variant="ghost" size="sm">
                  Retour aux tickets
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Timeline */}
        {ticket && !error && (
          <div className="mb-6">
            <TicketTimeline ticketId={ticketId} />
          </div>
        )}

        {/* Content */}
        {ticket && !error && (
          <TicketDetail ticket={ticket} onUpdate={handleUpdate} />
        )}

        {/* Diagnosis Panel + Agent Chat (grouped when chat is open) */}
        {ticket && !error && (
          <div className={`mt-6 ${showAgentChat ? 'border dark:border-gray-700 rounded-xl overflow-hidden' : ''}`}>
            <div className={showAgentChat ? 'p-4' : ''}>
              <DiagnosisPanel
                ticketId={ticketId}
                diagnosis={diagnosis}
                isLoading={isDiagnosisLoading}
                onAskAgent={handleAskAgent}
              />
            </div>
            {showAgentChat && (
              <AgentChatV2
                ticketId={ticketId}
                onClose={() => setShowAgentChat(false)}
                onDiagnosisUpdate={fetchDiagnosis}
              />
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
