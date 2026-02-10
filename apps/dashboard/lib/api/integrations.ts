import { apiRequest } from './client';
import type {
  Integration,
  IntegrationSyncLog,
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
    page = 0,
    limit = 20
  ): Promise<{ data: IntegrationSyncLog[]; total: number; page: number; limit: number }> => {
    return apiRequest(`/api/integrations/${id}/logs?page=${page}&limit=${limit}`);
  },

  getTypes: async (): Promise<IntegrationType[]> => {
    return apiRequest('/api/integrations/types');
  },
};
