/**
 * Tickets API Client
 * Interface pour communiquer avec l'API backend pour les tickets
 */

import type {
  Ticket,
  TicketFilters,
  PaginatedResponse,
  TicketStats,
  TicketStatus,
} from '../types/ticket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Build query string from filters
 */
function buildQueryString(filters: TicketFilters): string {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v.toString()));
      } else if (key === 'page' && typeof value === 'number') {
        // Frontend uses 1-based pages, backend expects 0-based
        params.append(key, Math.max(0, value - 1).toString());
      } else {
        params.append(key, value.toString());
      }
    }
  });

  return params.toString();
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || 'API request failed',
      errorData
    );
  }

  return response.json();
}

/**
 * Tickets API
 */
export const ticketsApi = {
  /**
   * Get paginated list of tickets with filters
   */
  async getTickets(filters: TicketFilters = {}): Promise<PaginatedResponse<Ticket>> {
    const queryString = buildQueryString(filters);
    const endpoint = `/api/tickets${queryString ? `?${queryString}` : ''}`;
    return apiRequest<PaginatedResponse<Ticket>>(endpoint);
  },

  /**
   * Get single ticket by ID
   */
  async getTicket(id: string): Promise<Ticket> {
    return apiRequest<Ticket>(`/api/tickets/${id}`);
  },

  /**
   * Update ticket
   */
  async updateTicket(
    id: string,
    data: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Ticket> {
    return apiRequest<Ticket>(`/api/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update ticket status
   */
  async updateStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return this.updateTicket(id, { status });
  },

  /**
   * Assign ticket to user
   */
  async assignTicket(id: string, userId: string): Promise<Ticket> {
    return this.updateTicket(id, { assignedTo: userId });
  },

  /**
   * Unassign ticket
   */
  async unassignTicket(id: string): Promise<Ticket> {
    return this.updateTicket(id, { assignedTo: undefined });
  },

  /**
   * Delete ticket
   */
  async deleteTicket(id: string): Promise<void> {
    return apiRequest<void>(`/api/tickets/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get ticket statistics
   */
  async getStats(period?: string): Promise<TicketStats> {
    const query = period ? `?period=${period}` : '';
    return apiRequest<TicketStats>(`/api/tickets/stats${query}`);
  },

  /**
   * Perform bulk action on multiple tickets
   * Uses individual endpoints with Promise.allSettled for partial failure handling
   */
  async bulkAction(
    ticketIds: string[],
    action: string,
    value?: any
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    const results = await Promise.allSettled(
      ticketIds.map((id) => {
        switch (action) {
          case 'status':
            return this.updateStatus(id, value);
          case 'assign':
            return this.assignTicket(id, value);
          case 'unassign':
            return this.unassignTicket(id);
          case 'severity':
            return this.updateTicket(id, { severity: value });
          case 'delete':
            return this.deleteTicket(id);
          default:
            return Promise.reject(new Error(`Unknown action: ${action}`));
        }
      })
    );

    const processed = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected');
    const errors = failures.map((r) =>
      r.status === 'rejected' ? (r.reason?.message || 'Unknown error') : ''
    );

    return { processed, failed: failures.length, errors };
  },
};

export { ApiError };
