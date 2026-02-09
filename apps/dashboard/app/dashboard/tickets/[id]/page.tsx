/**
 * Ticket Detail Page
 * Page de détail d'un ticket spécifique
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import type { Ticket } from '@/lib/types/ticket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { PageLoader, Button } from '@/components/ui';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth();

  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = async () => {
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
  };

  useEffect(() => {
    if (!authLoading && ticketId) {
      fetchTicket();
    }
  }, [ticketId, authLoading]);

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
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                >
                  🗑️ Supprimer
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Erreur</h3>
            <p className="text-red-700 mb-4">{error}</p>
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

        {/* Chat with AI Agent */}
        {ticket && !error && (
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">AI Agent</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ticket.agentSession || (ticket.agentSessions && ticket.agentSessions.length > 0)
                    ? 'An AI session exists for this ticket.'
                    : 'Start an AI analysis to get insights and troubleshooting help.'}
                </p>
              </div>
              <Link href={`/dashboard/tickets/${ticketId}/chat`}>
                <Button variant="primary" size="sm">
                  {ticket.agentSession || (ticket.agentSessions && ticket.agentSessions.length > 0)
                    ? 'Open Chat'
                    : 'Start AI Analysis'}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Content */}
        {ticket && !error && (
          <TicketDetail ticket={ticket} onUpdate={handleUpdate} />
        )}

        {/* Floating chat button */}
        {ticket && !error && (
          <Link
            href={`/dashboard/tickets/${ticketId}/chat`}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors group"
            title="Chat with AI Agent"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {/* Unread badge - visible when session exists */}
            {(ticket.agentSession || (ticket.agentSessions && ticket.agentSessions.length > 0)) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
            )}
          </Link>
        )}
      </div>
    </DashboardLayout>
  );
}
