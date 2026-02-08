/**
 * Ticket Table Component
 * Table affichant les tickets avec tri
 */

'use client';

import Link from 'next/link';
import type { Ticket } from '@/lib/types/ticket';
import { StatusBadge, SeverityBadge, TypeBadge } from '@/components/ui';
import { TicketCheckbox } from './TicketCheckbox';

interface TicketTableProps {
  tickets: Ticket[];
  onSort?: (field: string) => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  selectedTickets?: string[];
  onSelectTicket?: (ticketId: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
}

export function TicketTable({ tickets, onSort, sortField, sortOrder, selectedTickets = [], onSelectTicket, onSelectAll }: TicketTableProps) {
  const handleSort = (field: string) => {
    if (onSort) {
      onSort(field);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  const allSelected = tickets.length > 0 && selectedTickets.length === tickets.length;

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎫</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun ticket trouvé</h3>
        <p className="text-gray-600">Modifiez vos filtres pour voir plus de résultats.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelectAll && (
              <th className="px-6 py-3 text-left">
                <TicketCheckbox
                  checked={allSelected}
                  onChange={(checked) => onSelectAll(checked)}
                />
              </th>
            )}
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center space-x-1">
                <span>Titre</span>
                <SortIcon field="title" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('severity')}
            >
              <div className="flex items-center space-x-1">
                <span>Sévérité</span>
                <SortIcon field="severity" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Application
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('createdAt')}
            >
              <div className="flex items-center space-x-1">
                <span>Date</span>
                <SortIcon field="createdAt" />
              </div>
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tickets.map((ticket) => {
            const createdAt = new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <tr key={ticket.id} className="hover:bg-gray-50">
                {onSelectTicket && (
                  <td className="px-6 py-4">
                    <TicketCheckbox
                      checked={selectedTickets.includes(ticket.id)}
                      onChange={(checked) => onSelectTicket(ticket.id, checked)}
                    />
                  </td>
                )}
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {ticket.title}
                    </Link>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                      {ticket.description}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <TypeBadge type={ticket.type} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SeverityBadge severity={ticket.severity} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {ticket.application?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {createdAt}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Voir →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
