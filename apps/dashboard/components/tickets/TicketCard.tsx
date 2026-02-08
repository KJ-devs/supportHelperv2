/**
 * Ticket Card Component
 * Carte affichant un ticket en vue grille
 */

'use client';

import Link from 'next/link';
import type { Ticket } from '@/lib/types/ticket';
import { StatusBadge, SeverityBadge, TypeBadge } from '@/components/ui';

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const createdAt = new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Link href={`/dashboard/tickets/${ticket.id}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border border-gray-200 hover:border-blue-300 cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
              {ticket.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">{ticket.description}</p>
          </div>
          <SeverityBadge severity={ticket.severity} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusBadge status={ticket.status} />
          <TypeBadge type={ticket.type} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
          <div className="flex items-center space-x-2">
            {ticket.application && (
              <span className="flex items-center">
                📱 {ticket.application.name}
              </span>
            )}
          </div>
          <span>{createdAt}</span>
        </div>

        {/* AI Summary */}
        {ticket.aiSummary && (
          <div className="mt-2 text-xs text-gray-600 bg-blue-50 rounded p-2">
            <span className="font-medium">🤖 IA:</span> {ticket.aiSummary.substring(0, 100)}
            {ticket.aiSummary.length > 100 && '...'}
          </div>
        )}
      </div>
    </Link>
  );
}
