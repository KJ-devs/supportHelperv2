import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api';

// Types
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  customerId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: Ticket['priority'];
  category: string;
  customerEmail: string;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  status?: Ticket['status'];
  priority?: Ticket['priority'];
  assigneeId?: string | null;
}

export interface TicketsResponse {
  data: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

// Query keys
export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...ticketKeys.lists(), filters] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
};

// Fetch functions
async function fetchTickets(params?: URLSearchParams): Promise<TicketsResponse> {
  const queryString = params ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/tickets${queryString}`);
  if (!response.ok) throw new Error('Failed to fetch tickets');
  return response.json();
}

async function fetchTicket(id: string): Promise<Ticket> {
  const response = await fetch(`${API_BASE}/tickets/${id}`);
  if (!response.ok) throw new Error('Failed to fetch ticket');
  return response.json();
}

async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const response = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Failed to create ticket');
  return response.json();
}

async function updateTicket({ id, ...input }: UpdateTicketInput & { id: string }): Promise<Ticket> {
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

// Hooks
export function useTickets(filters?: Record<string, string>) {
  const params = filters ? new URLSearchParams(filters) : undefined;
  return useQuery({
    queryKey: ticketKeys.list(filters || {}),
    queryFn: () => fetchTickets(params),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => fetchTicket(id),
    enabled: !!id,
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
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      queryClient.setQueryData(ticketKeys.detail(data.id), data);
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
