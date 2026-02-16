/**
 * Usage API Client
 * API client for usage and billing endpoints
 */

import { apiRequest } from './client';
import type { UsageResponse, UsageHistoryResponse } from '../types/usage';

/**
 * Get current usage metrics
 */
export async function getCurrentUsage(): Promise<UsageResponse> {
  return apiRequest<UsageResponse>('/api/system/usage');
}

/**
 * Get usage history over time
 */
export async function getUsageHistory(): Promise<UsageHistoryResponse> {
  return apiRequest<UsageHistoryResponse>('/api/system/usage/history');
}
