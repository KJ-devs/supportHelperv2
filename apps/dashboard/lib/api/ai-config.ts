import { apiRequest } from './client';
import type {
  AIProviderType,
  AiConfigResponse,
  AIConfigUpdate,
  ValidateKeyResponse,
  TestConnectionPayload,
} from '@/lib/types/ai-config';

// Re-export types for convenience
export type { AIProviderType, AiConfigResponse, AIConfigUpdate, ValidateKeyResponse, TestConnectionPayload };

export const aiConfigApi = {
  getConfig: async (): Promise<AiConfigResponse> => {
    return apiRequest('/api/settings/ai');
  },

  updateConfig: async (data: AIConfigUpdate): Promise<AiConfigResponse> => {
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

  testConnection: async (payload: TestConnectionPayload): Promise<ValidateKeyResponse> => {
    return apiRequest('/api/settings/ai/validate-key', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
