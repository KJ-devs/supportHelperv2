/**
 * Tickets List Page
 * Page principale de la liste des tickets
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import type { Ticket, TicketFilters, PaginatedResponse } from '@/lib/types/ticket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TicketTable } from '@/components/tickets/TicketTable';
import { TicketCard } from '@/components/tickets/TicketCard';
import { TicketFilters as Filters } from '@/components/tickets/TicketFilters';
import { Pagination } from '@/components/tickets/Pagination';
import { BulkActions } from '@/components/tickets/BulkActions';
import { ExportButton } from '@/components/export/ExportButton';
import { PageLoader, Button } from '@/components/ui';
import { useTicketSocket, type TicketEvent } from '@/hooks/useTicketSocket';

type ViewMode = 'table' | 'grid';

export default function TicketsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);

  const [filters, setFilters] = useState<TicketFilters>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Real-time notification state
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response: PaginatedResponse<Ticket> = await ticketsApi.getTickets(filters);
      setTickets(response.data);
      // Backend returns 0-based page, convert to 1-based for UI
      setPagination({
        ...response.pagination,
        page: response.pagination.page + 1,
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des tickets');
      console.error('Error fetching tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Handle real-time ticket events
  const handleTicketEvent = useCallback((event: TicketEvent) => {
    switch (event.event) {
      case 'ticket:created': {
        const ticket = event.ticket as Ticket;
        // If on page 1 with default sort, prepend the new ticket
        if (filters.page === 1 && filters.sortBy === 'createdAt' && filters.sortOrder === 'desc') {
          setTickets((prev) => [ticket, ...prev.slice(0, (filters.limit || 20) - 1)]);
          setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
        }
        setNotification(`New ticket: ${ticket.title || 'Untitled'}`);
        break;
      }
      case 'ticket:updated':
      case 'ticket:assigned':
      case 'ticket:ai-analysis-completed': {
        const updated = event.ticket;
        setTickets((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
        const label = event.event === 'ticket:assigned'
          ? 'Ticket assigned'
          : event.event === 'ticket:ai-analysis-completed'
          ? 'AI analysis completed'
          : 'Ticket updated';
        setNotification(label);
        break;
      }
      case 'ticket:deleted': {
        const deletedId = event.ticket.id;
        setTickets((prev) => prev.filter((t) => t.id !== deletedId));
        setSelectedTickets((prev) => prev.filter((id) => id !== deletedId));
        setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        setNotification('Ticket deleted');
        break;
      }
      case 'ticket:bulk-updated': {
        fetchTickets();
        setNotification('Tickets updated in bulk');
        break;
      }
    }
  }, [filters.page, filters.sortBy, filters.sortOrder, filters.limit, fetchTickets]);

  const { isConnected } = useTicketSocket(handleTicketEvent);

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    if (!authLoading) {
      fetchTickets();
    }
  }, [authLoading, fetchTickets]);

  const handleFiltersChange = (newFilters: TicketFilters) => {
    setFilters({ ...newFilters });
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (field: string) => {
    const newOrder = filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    setFilters({
      ...filters,
      sortBy: field as any,
      sortOrder: newOrder,
    });
  };

  const handleSelectTicket = (ticketId: string, checked: boolean) => {
    if (checked) {
      setSelectedTickets([...selectedTickets, ticketId]);
    } else {
      setSelectedTickets(selectedTickets.filter((id) => id !== ticketId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTickets(tickets.map((t) => t.id));
    } else {
      setSelectedTickets([]);
    }
  };

  const handleBulkActionComplete = () => {
    setSelectedTickets([]);
    fetchTickets();
  };

  const handleBulkActionCancel = () => {
    setSelectedTickets([]);
  };

  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Tickets</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
                Gérez et suivez tous les tickets de support
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Export Button */}
              <ExportButton tickets={tickets} filters={filters} />

              {/* View Mode Toggle - Hidden on mobile, table shows cards automatically */}
              <div className="hidden sm:flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 rounded min-h-[40px] ${
                    viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow' : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title="Vue table"
                  aria-label="Vue table"
                >
                  📋
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 rounded min-h-[40px] ${
                    viewMode === 'grid' ? 'bg-white dark:bg-gray-800 shadow' : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title="Vue grille"
                  aria-label="Vue grille"
                >
                  📦
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <Filters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleResetFilters}
          />
        </div>

        {/* Bulk Actions */}
        {selectedTickets.length > 0 && (
          <div className="mb-6">
            <BulkActions
              selectedTickets={selectedTickets}
              onComplete={handleBulkActionComplete}
              onCancel={handleBulkActionCancel}
            />
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 bg-white dark:bg-gray-900 p-4 rounded-lg shadow dark:shadow-gray-800/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-gray-100">{pagination.total}</span> ticket(s) au total
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title="Real-time updates active">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
            {isLoading && (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <svg
                  className="animate-spin h-4 w-4 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Chargement...
              </div>
            )}
          </div>
        </div>

        {/* Real-time Notification */}
        {notification && (
          <div className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-3 flex items-center justify-between text-sm text-blue-800 dark:text-blue-200 animate-in fade-in duration-300">
            <span className="flex-1">{notification}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Fermer la notification"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Erreur</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTickets}
                className="w-full sm:w-auto"
              >
                Réessayer
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-gray-800/20 overflow-hidden">
          {isLoading && tickets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement des tickets...</p>
            </div>
          ) : viewMode === 'table' ? (
            <TicketTable
              tickets={tickets}
              onSort={handleSort}
              sortField={filters.sortBy}
              sortOrder={filters.sortOrder}
              selectedTickets={selectedTickets}
              onSelectTicket={handleSelectTicket}
              onSelectAll={handleSelectAll}
            />
          ) : (
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
              {tickets.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="text-6xl mb-4">🎫</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Aucun ticket trouvé
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Modifiez vos filtres pour voir plus de résultats.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && tickets.length > 0 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
