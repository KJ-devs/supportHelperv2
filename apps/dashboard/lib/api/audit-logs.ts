/**
 * Audit Logs API Client
 */

import { apiRequest } from './client';

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string;
  actorType: 'user' | 'system' | 'agent';
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogsFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const auditLogsApi = {
  /**
   * Get audit logs with filters and pagination
   */
  async getLogs(filters: AuditLogsFilters = {}): Promise<AuditLogsResponse> {
    const params = new URLSearchParams();

    if (filters.actorId) params.append('actorId', filters.actorId);
    if (filters.action) params.append('action', filters.action);
    if (filters.resourceType) params.append('resourceType', filters.resourceType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());

    const query = params.toString();
    return apiRequest<AuditLogsResponse>(
      `/api/audit-logs${query ? `?${query}` : ''}`
    );
  },

  /**
   * Export audit logs as CSV
   */
  async exportLogs(filters: AuditLogsFilters = {}): Promise<Blob> {
    const params = new URLSearchParams();

    if (filters.actorId) params.append('actorId', filters.actorId);
    if (filters.action) params.append('action', filters.action);
    if (filters.resourceType) params.append('resourceType', filters.resourceType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const query = params.toString();
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audit-logs/export${query ? `?${query}` : ''}`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to export audit logs');
    }

    return response.blob();
  },
};
