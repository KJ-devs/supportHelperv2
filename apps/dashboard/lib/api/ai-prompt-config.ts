import { apiRequest } from './client';

export interface AiPromptConfigResponse {
  configured: boolean;
  productDescription: string | null;
  globalInstructions: string | null;
  triageInstructions: string | null;
  n1Instructions: string | null;
  analysisInstructions: string | null;
  responseLanguage: string | null;
  enableTriage?: boolean;
  enableN1?: boolean;
  enableN2?: boolean;
  triageTemperature?: number | null;
  n1Temperature?: number | null;
  analysisTemperature?: number | null;
  maxIterationsN2?: number | null;
  timeoutN2?: number | null;
}

export interface AiPromptConfigUpdate {
  productDescription?: string;
  globalInstructions?: string;
  triageInstructions?: string;
  n1Instructions?: string;
  analysisInstructions?: string;
  responseLanguage?: string;
  enableTriage?: boolean;
  enableN1?: boolean;
  enableN2?: boolean;
  triageTemperature?: number;
  n1Temperature?: number;
  analysisTemperature?: number;
  maxIterationsN2?: number;
  timeoutN2?: number;
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
