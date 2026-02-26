/**
 * Ticket Table Component
 * Table affichant les tickets avec tri
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Ticket } from '@/lib/types/ticket';
import { StatusBadge, SeverityBadge, TypeBadge } from '@/components/ui';
import { TicketCheckbox } from './TicketCheckbox';
import { Ticket as TicketIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sort tickets in descending order by createdAt date by default
  const sortedTickets = [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSort = (field: string) => {
    if (onSort) {
      onSort(field);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" aria-hidden="true" /> : <ArrowDown className="w-4 h-4" aria-hidden="true" />;
  };

  const allSelected = tickets.length > 0 && selectedTickets.length === tickets.length;

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <TicketIcon className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" aria-hidden="true" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Aucun ticket trouvé</h3>
        <p className="text-gray-600 dark:text-gray-400">Modifiez vos filtres pour voir plus de résultats.</p>
      </div>
    );
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <div className="space-y-3 p-4">
        {onSelectAll && (
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tout sélectionner</span>
            <TicketCheckbox
              checked={allSelected}
              onChange={(checked) => onSelectAll(checked)}
            />
          </div>
        )}
        {sortedTickets.map((ticket) => {
          const createdAt = new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={ticket.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4"
            >
              {/* Header with checkbox */}
              <div className="flex items-start gap-3 mb-3">
                {onSelectTicket && (
                  <TicketCheckbox
                    checked={selectedTickets.includes(ticket.id)}
                    onChange={(checked) => onSelectTicket(ticket.id, checked)}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="text-base font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline line-clamp-2"
                  >
                    {ticket.title}
                  </Link>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                    {ticket.description}
                  </p>
                </div>
                <SeverityBadge severity={ticket.severity} />
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <StatusBadge status={ticket.status} />
                <TypeBadge type={ticket.type} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t dark:border-gray-700">
                <div className="flex items-center gap-2">
                  {ticket.application && (
                    <span className="truncate">📱 {ticket.application.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap">{createdAt}</span>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Voir le ticket"
                  >
                    →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
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
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center space-x-1">
                <span>Titre</span>
                <SortIcon field="title" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Type
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
              onClick={() => handleSort('severity')}
            >
              <div className="flex items-center space-x-1">
                <span>Sévérité</span>
                <SortIcon field="severity" />
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Application
            </th>
            <th
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
              onClick={() => handleSort('createdAt')}
            >
              <div className="flex items-center space-x-1">
                <span>Date</span>
                <SortIcon field="createdAt" />
              </div>
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {sortedTickets.map((ticket) => {
            const createdAt = new Date(ticket.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
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
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                    >
                      {ticket.title}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {ticket.application?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {createdAt}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
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
