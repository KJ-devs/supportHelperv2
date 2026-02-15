/**
 * Health API Client
 * Fetches system health status from the API (public endpoint, no auth required)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
  lastCheck?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services?: Record<string, HealthCheck>;
}

export const healthApi = {
  async getHealth(): Promise<HealthStatus> {
    const response = await fetch(`${API_URL}/health`, {
      cache: 'no-store',
    });
    return response.json();
  },
};
