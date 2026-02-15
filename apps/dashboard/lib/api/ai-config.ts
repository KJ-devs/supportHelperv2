import { apiRequest } from './client';

export interface AiConfigResponse {
  configured: boolean;
  id?: string;
  tenantId?: string;
  provider: string;
  maskedApiKey: string | null;
  model: string;
  settings: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidateKeyResponse {
  valid: boolean;
  error?: string;
}

export const aiConfigApi = {
  getConfig: async (): Promise<AiConfigResponse> => {
    return apiRequest('/api/settings/ai');
  },

  updateConfig: async (data: {
    apiKey?: string;
    model?: string;
    settings?: Record<string, any>;
  }): Promise<AiConfigResponse> => {
    return apiRequest('/api/settings/ai', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  validateKey: async (apiKey: string): Promise<ValidateKeyResponse> => {
    return apiRequest('/api/settings/ai/validate-key', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },
};
