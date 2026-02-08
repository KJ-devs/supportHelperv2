import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import type { Ticket, TicketStatus, TicketPriority, PaginatedResponse, User } from '@/types';

const API_BASE = '/api';

// Extended Ticket type with relations
export interface TicketWithRelations extends Ticket {
  customer: User;
  assignee: User | null;
}

export interface TicketFilters {
  search?: string;
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  type?: string | 'all';
  severity?: string | 'all';
  assigneeId?: string | 'all' | 'unassigned';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TicketsResponse extends PaginatedResponse<TicketWithRelations> {
  facets?: {
    status: Record<string, number>;
    priority: Record<string, number>;
    type: Record<string, number>;
  };
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: TicketPriority;
  category: string;
  customerEmail: string;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
}

export interface BulkUpdateInput {
  ids: string[];
  data: Partial<UpdateTicketInput>;
}

export interface SearchResult {
  tickets: TicketWithRelations[];
  facets: {
    status: Record<string, number>;
    priority: Record<string, number>;
    type: Record<string, number>;
  };
  total: number;
  query: string;
  processingTimeMs: number;
}

// Query keys
export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: TicketFilters) => [...ticketKeys.lists(), filters] as const,
  infinite: (filters: TicketFilters) => [...ticketKeys.all, 'infinite', filters] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  search: (query: string, filters?: TicketFilters) =>
    [...ticketKeys.all, 'search', query, filters] as const,
};

// Build query params
function buildQueryParams(filters: TicketFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
  if (filters.assigneeId && filters.assigneeId !== 'all')
    params.set('assigneeId', filters.assigneeId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.pageSize) params.set('pageSize', filters.pageSize.toString());
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  return params;
}

// Fetch functions
async function fetchTickets(filters: TicketFilters = {}): Promise<TicketsResponse> {
  const params = buildQueryParams(filters);
  const queryString = params.toString();
  const response = await fetch(`${API_BASE}/tickets${queryString ? `?${queryString}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch tickets');
  return response.json();
}

async function fetchTicket(id: string): Promise<TicketWithRelations> {
  const response = await fetch(`${API_BASE}/tickets/${id}`);
  if (!response.ok) throw new Error('Failed to fetch ticket');
  return response.json();
}

async function createTicket(input: CreateTicketInput): Promise<TicketWithRelations> {
  const response = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create ticket');
  return response.json();
}

async function updateTicket({
  id,
  ...input
}: UpdateTicketInput & { id: string }): Promise<TicketWithRelations> {
  const response = await fetch(`${API_BASE}/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to update ticket');
  return response.json();
}

async function deleteTicket(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/tickets/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete ticket');
}

async function bulkUpdateTickets(input: BulkUpdateInput): Promise<TicketWithRelations[]> {
  const response = await fetch(`${API_BASE}/tickets/bulk`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to bulk update tickets');
  return response.json();
}

async function bulkDeleteTickets(ids: string[]): Promise<void> {
  const response = await fetch(`${API_BASE}/tickets/bulk`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error('Failed to bulk delete tickets');
}

async function searchTickets(query: string, filters: TicketFilters = {}): Promise<SearchResult> {
  const params = buildQueryParams({ ...filters, search: query });
  const response = await fetch(`${API_BASE}/tickets/search?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to search tickets');
  return response.json();
}

// Hooks
export function useTickets(filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => fetchTickets(filters),
    placeholderData: previousData => previousData,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useInfiniteTickets(filters: TicketFilters = {}) {
  return useInfiniteQuery({
    queryKey: ticketKeys.infinite(filters),
    queryFn: ({ pageParam = 1 }) => fetchTickets({ ...filters, page: pageParam }),
    getNextPageParam: lastPage => {
      const totalPages = Math.ceil(lastPage.total / (filters.pageSize || 50));
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => fetchTicket(id),
    enabled: !!id,
  });
}

export function useSearchTickets(query: string, filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ticketKeys.search(query, filters),
    queryFn: () => searchTickets(query, filters),
    enabled: query.length >= 2,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTicket,
    onMutate: async ({ id, ...newData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ticketKeys.detail(id) });

      // Snapshot the previous value
      const previousTicket = queryClient.getQueryData<TicketWithRelations>(ticketKeys.detail(id));

      // Optimistically update
      if (previousTicket) {
        queryClient.setQueryData(ticketKeys.detail(id), {
          ...previousTicket,
          ...newData,
        });
      }

      return { previousTicket };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousTicket) {
        queryClient.setQueryData(ticketKeys.detail(id), context.previousTicket);
      }
    },
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTicket,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.removeQueries({ queryKey: ticketKeys.detail(id) });
    },
  });
}

export function useBulkUpdateTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkUpdateTickets,
    onMutate: async ({ ids, data }) => {
      // Optimistically update list cache
      await queryClient.cancelQueries({ queryKey: ticketKeys.lists() });

      // We can't easily do optimistic updates on paginated data
      // So we'll just invalidate on success
      return { ids };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}

export function useBulkDeleteTickets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteTickets,
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      ids.forEach(id => {
        queryClient.removeQueries({ queryKey: ticketKeys.detail(id) });
      });
    },
  });
}
