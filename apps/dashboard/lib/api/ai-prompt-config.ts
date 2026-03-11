import { apiRequest } from './client';

export interface AiPromptConfigResponse {
  configured: boolean;
  productDescription: string | null;
  globalInstructions: string | null;
  triageInstructions: string | null;
  analysisInstructions: string | null;
  responseLanguage: string | null;
}

export interface AiPromptConfigUpdate {
  productDescription?: string;
  globalInstructions?: string;
  triageInstructions?: string;
  analysisInstructions?: string;
  responseLanguage?: string;
}

export const aiPromptConfigApi = {
  getConfig: async (): Promise<AiPromptConfigResponse> => {
    return apiRequest('/api/settings/ai/prompts');
  },

  updateConfig: async (data: AiPromptConfigUpdate): Promise<AiPromptConfigResponse> => {
    return apiRequest('/api/settings/ai/prompts', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
