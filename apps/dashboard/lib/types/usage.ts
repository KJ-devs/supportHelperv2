/**
 * Usage Types
 * Type definitions for usage and billing
 */

export interface UsageMetric {
  metric: 'tickets' | 'agent_tasks' | 'users' | 'repos';
  current: number;
  limit: number | null;
  percentage: number;
}

export interface UsageAlert {
  metric: string;
  percentage: number;
  message: string;
}

export interface UsageResponse {
  plan: 'free' | 'pro' | 'enterprise';
  metrics: UsageMetric[];
  expiresAt: string | null;
  alerts: UsageAlert[];
}

export interface MonthlyUsageData {
  month: string;
  tickets: number;
  agent_tasks: number;
}

export interface UsageHistoryResponse {
  months: string[];
  data: MonthlyUsageData[];
}
