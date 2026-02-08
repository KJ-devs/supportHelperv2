/**
 * Analytics API Client
 * Interface pour récupérer les statistiques et métriques
 */

import type {
  AnalyticsData,
  DashboardStats,
  TimeRange,
} from '../types/analytics';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.message || 'API request failed',
      errorData
    );
  }

  return response.json();
}

function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString());
    }
  });
  return searchParams.toString();
}

export const analyticsApi = {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(timeRange?: Partial<TimeRange>): Promise<DashboardStats> {
    const query = timeRange ? `?${buildQueryString(timeRange)}` : '';
    return apiRequest<DashboardStats>(`/api/analytics/stats${query}`);
  },

  /**
   * Get complete analytics data
   */
  async getAnalytics(timeRange?: Partial<TimeRange>): Promise<AnalyticsData> {
    const query = timeRange ? `?${buildQueryString(timeRange)}` : '';
    return apiRequest<AnalyticsData>(`/api/analytics${query}`);
  },

  /**
   * Get ticket trends over time
   */
  async getTicketTrends(timeRange?: Partial<TimeRange>): Promise<any> {
    const query = timeRange ? `?${buildQueryString(timeRange)}` : '';
    return apiRequest(`/api/analytics/trends${query}`);
  },

  /**
   * Export analytics data
   */
  async exportData(format: 'csv' | 'json', timeRange?: Partial<TimeRange>): Promise<Blob> {
    const query = timeRange ? `&${buildQueryString(timeRange)}` : '';
    const token = getAuthToken();

    const response = await fetch(
      `${API_URL}/api/analytics/export?format=${format}${query}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    if (!response.ok) {
      throw new ApiError(response.status, 'Export failed');
    }

    return response.blob();
  },
};

export { ApiError };
