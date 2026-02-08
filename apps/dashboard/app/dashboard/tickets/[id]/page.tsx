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

        {/* Content */}
        {ticket && !error && (
          <TicketDetail ticket={ticket} onUpdate={handleUpdate} />
        )}
      </div>
    </DashboardLayout>
  );
}
