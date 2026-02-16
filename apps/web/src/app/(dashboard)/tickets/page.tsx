'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { type SortingState, type RowSelectionState } from '@tanstack/react-table';

// Hooks
import {
  useTickets,
  useBulkUpdateTickets,
  useBulkDeleteTickets,
  type TicketWithRelations,
} from '@/hooks/use-tickets-advanced';
import { useMeilisearch } from '@/hooks/use-meilisearch';
import { useToast } from '@/hooks/use-toast';
import { useTicketTableStore } from '@/stores/ticket-table-store';

// Components
import { TicketsDataTable } from '@/components/tickets/tickets-data-table';
import { TicketSearchInput } from '@/components/tickets/ticket-search-input';
import { AdvancedFilters } from '@/components/tickets/advanced-filters';
import { TicketFacetsSidebar } from '@/components/tickets/ticket-facets-sidebar';
import { BulkActions } from '@/components/tickets/bulk-actions';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Plus, SlidersHorizontal, PanelRightClose, PanelRightOpen, RefreshCw, Inbox, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

import type { TicketStatus, TicketPriority } from '@/types';

export default function TicketsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Store
  const {
    filters,
    sort,
    pagination,
    setSearch,
    setStatus,
    setPriority,
    setType,
    setAssignee,
    setDateRange,
    resetFilters,
    setSort,
    setPage,
    setPageSize,
    isFacetsSidebarOpen,
    toggleFacetsSidebar,
  } = useTicketTableStore();

  // Local state for table
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: sort.sortBy, desc: sort.sortOrder === 'desc' },
  ]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  // Build query params
  const queryParams = React.useMemo(
    () => ({
      search: filters.search || undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      priority: filters.priority !== 'all' ? filters.priority : undefined,
      type: filters.type !== 'all' ? filters.type : undefined,
      assigneeId: filters.assigneeId !== 'all' ? filters.assigneeId : undefined,
      dateFrom: filters.dateRange.from || undefined,
      dateTo: filters.dateRange.to || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    }),
    [filters, pagination, sort]
  );

  // Fetch tickets
  const { data: ticketsData, isLoading, isFetching, refetch } = useTickets(queryParams);

  // Meilisearch for live search
  const {
    query: searchQuery,
    results: searchResults,
    isLoading: isSearching,
    search: performSearch,
  } = useMeilisearch(queryParams);

  // Mutations
  const bulkUpdate = useBulkUpdateTickets();
  const bulkDelete = useBulkDeleteTickets();

  // Computed values
  const tickets = searchQuery && searchResults ? searchResults.tickets : ticketsData?.data || [];
  const total = searchQuery && searchResults ? searchResults.total : ticketsData?.total || 0;
  const facets = searchQuery && searchResults ? searchResults.facets : ticketsData?.facets || null;

  const selectedIds = React.useMemo(
    () => Object.keys(rowSelection).filter(id => rowSelection[id]),
    [rowSelection]
  );

  const selectedCount = selectedIds.length;

  // Sync sorting with store
  React.useEffect(() => {
    if (sorting.length > 0) {
      const { id, desc } = sorting[0];
      setSort(id, desc ? 'desc' : 'asc');
    }
  }, [sorting, setSort]);

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (value.length >= 2) {
      performSearch(value);
    }
  };

  const handleFacetFilter = (facet: string, value: string | null) => {
    switch (facet) {
      case 'status':
        setStatus((value as TicketStatus) || 'all');
        break;
      case 'priority':
        setPriority((value as TicketPriority) || 'all');
        break;
      case 'type':
        setType(value || 'all');
        break;
    }
  };

  const handleBulkAssign = async (assigneeId: string) => {
    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        data: { assigneeId },
      });
      toast({
        title: 'Tickets assigned',
        description: `${selectedCount} tickets have been assigned.`,
      });
      setRowSelection({});
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to assign tickets.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkUpdateStatus = async (status: TicketStatus) => {
    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        data: { status },
      });
      toast({
        title: 'Status updated',
        description: `${selectedCount} tickets have been updated.`,
      });
      setRowSelection({});
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update tickets.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkUpdatePriority = async (priority: TicketPriority) => {
    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        data: { priority },
      });
      toast({
        title: 'Priority updated',
        description: `${selectedCount} tickets have been updated.`,
      });
      setRowSelection({});
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update tickets.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDelete.mutateAsync(selectedIds);
      toast({
        title: 'Tickets deleted',
        description: `${selectedCount} tickets have been deleted.`,
      });
      setRowSelection({});
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete tickets.',
        variant: 'destructive',
      });
    }
  };

  const handleView = (ticket: TicketWithRelations) => {
    router.push(`/tickets/${ticket.id}`);
  };

  const handleEdit = (ticket: TicketWithRelations) => {
    // Navigate to detail page for editing (edit page not yet implemented)
    handleView(ticket);
  };

  const handleDelete = async (ticket: TicketWithRelations) => {
    try {
      await bulkDelete.mutateAsync([ticket.id]);
      toast({
        title: 'Ticket deleted',
        description: 'The ticket has been deleted.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete ticket.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tickets</h1>
              <p className="text-sm text-muted-foreground">Manage and respond to support tickets</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="icon" onClick={toggleFacetsSidebar}>
                {isFacetsSidebarOpen ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
              <Button onClick={() => router.push('/tickets/new')}>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              <TicketSearchInput
                value={filters.search}
                onChange={handleSearchChange}
                isLoading={isSearching}
                className="w-80"
                placeholder="Search by title, description, ID..."
              />

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Narrow down your ticket search</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <AdvancedFilters
                      filters={filters}
                      onStatusChange={setStatus}
                      onPriorityChange={setPriority}
                      onTypeChange={setType}
                      onAssigneeChange={setAssignee}
                      onDateRangeChange={setDateRange}
                      onReset={resetFilters}
                      className="flex-col items-stretch gap-3"
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Quick filters row */}
            <AdvancedFilters
              filters={filters}
              onStatusChange={setStatus}
              onPriorityChange={setPriority}
              onTypeChange={setType}
              onAssigneeChange={setAssignee}
              onDateRangeChange={setDateRange}
              onReset={resetFilters}
            />
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedCount > 0 && (
          <div className="border-b bg-muted/30 px-6 py-3">
            <BulkActions
              selectedCount={selectedCount}
              onBulkAssign={handleBulkAssign}
              onBulkUpdateStatus={handleBulkUpdateStatus}
              onBulkUpdatePriority={handleBulkUpdatePriority}
              onBulkDelete={handleBulkDelete}
              onClearSelection={() => setRowSelection({})}
              isLoading={bulkUpdate.isPending || bulkDelete.isPending}
            />
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-hidden p-6">
          {!isLoading && tickets.length === 0 ? (
            <EmptyState
              icon={filters.search ? SearchX : Inbox}
              title={filters.search ? 'No results found' : 'No tickets yet'}
              description={
                filters.search
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Get started by creating your first support ticket.'
              }
              action={
                filters.search
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        resetFilters();
                        setRowSelection({});
                      },
                    }
                  : {
                      label: 'Create ticket',
                      onClick: () => router.push('/tickets/new'),
                    }
              }
            />
          ) : (
            <TicketsDataTable
              data={tickets}
              isLoading={isLoading}
              sorting={sorting}
              onSortingChange={setSorting}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              enableVirtualization={tickets.length > 100}
            />
          )}
        </div>

        {/* Pagination */}
        <div className="border-t bg-background px-6 py-4">
          <DataTablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            selectedCount={selectedCount}
            isLoading={isLoading || isFetching}
            pageSizeOptions={[25, 50, 100]}
          />
        </div>
      </div>

      {/* Facets sidebar */}
      {isFacetsSidebarOpen && (
        <div className="w-64 border-l bg-muted/20">
          <div className="p-4">
            <h3 className="font-semibold">Refine by</h3>
          </div>
          <Separator />
          <TicketFacetsSidebar
            facets={facets}
            selectedFilters={{
              status: filters.status !== 'all' ? filters.status : undefined,
              priority: filters.priority !== 'all' ? filters.priority : undefined,
              type: filters.type !== 'all' ? filters.type : undefined,
            }}
            onFilterChange={handleFacetFilter}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}
