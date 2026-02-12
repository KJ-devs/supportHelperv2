import { apiRequest } from './client';
import type {
  Integration,
  IntegrationSyncLog,
  IntegrationSyncStats,
  IntegrationType,
  CreateIntegrationData,
} from '../types/integration';

export const integrationsApi = {
  getIntegrations: async (filters?: {
    type?: string;
    enabled?: boolean;
  }): Promise<Integration[]> => {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.enabled !== undefined) params.append('enabled', String(filters.enabled));

    return apiRequest(`/api/integrations?${params}`);
  },

  getIntegration: async (id: string): Promise<Integration> => {
    return apiRequest(`/api/integrations/${id}`);
  },

  createIntegration: async (data: CreateIntegrationData): Promise<Integration> => {
    return apiRequest('/api/integrations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateIntegration: async (
    id: string,
    data: Partial<CreateIntegrationData>
  ): Promise<Integration> => {
    return apiRequest(`/api/integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteIntegration: async (id: string): Promise<void> => {
    return apiRequest(`/api/integrations/${id}`, {
      method: 'DELETE',
    });
  },

  testConnection: async (
    id: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    return apiRequest(`/api/integrations/${id}/test`, {
      method: 'POST',
    });
  },

  syncTickets: async (id: string, ticketIds?: string[]): Promise<{ queued: number }> => {
    return apiRequest(`/api/integrations/${id}/sync`, {
      method: 'POST',
      body: JSON.stringify({ ticketIds }),
    });
  },

  getSyncLogs: async (
    id: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      action?: string;
      triggeredBy?: string;
      from?: string;
      to?: string;
    } = {}
  ): Promise<{ data: IntegrationSyncLog[]; total: number; page: number; limit: number }> => {
    const params = new URLSearchParams();
    if (options.page !== undefined) params.append('page', String(options.page));
    if (options.limit !== undefined) params.append('limit', String(options.limit));
    if (options.status) params.append('status', options.status);
    if (options.action) params.append('action', options.action);
    if (options.triggeredBy) params.append('triggeredBy', options.triggeredBy);
    if (options.from) params.append('from', options.from);
    if (options.to) params.append('to', options.to);
    return apiRequest(`/api/integrations/${id}/logs?${params}`);
  },

  getSyncStats: async (id: string): Promise<IntegrationSyncStats> => {
    return apiRequest(`/api/integrations/${id}/stats`);
  },

  getTypes: async (): Promise<IntegrationType[]> => {
    return apiRequest('/api/integrations/types');
  },
};
