import { apiRequest } from './client';

export interface AiUsageDayStats {
  date: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface AiUsageResponse {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  costPerTicket: number;
  byDay: AiUsageDayStats[];
  period: number;
}

export const aiUsageApi = {
  getUsage: async (): Promise<AiUsageResponse> => {
    return apiRequest<AiUsageResponse>('/api/settings/ai/usage');
  },
};
