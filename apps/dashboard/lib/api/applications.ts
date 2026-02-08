/**
 * Applications API Client
 * Interface pour gérer les applications et SDK keys
 */

import type {
  Application,
  CreateApplicationData,
  UpdateApplicationData,
  ApplicationStats,
} from '../types/application';

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

export const applicationsApi = {
  /**
   * Get all applications
   */
  async getApplications(): Promise<Application[]> {
    return apiRequest<Application[]>('/api/applications');
  },

  /**
   * Get single application by ID
   */
  async getApplication(id: string): Promise<Application> {
    return apiRequest<Application>(`/api/applications/${id}`);
  },

  /**
   * Create new application
   */
  async createApplication(data: CreateApplicationData): Promise<Application> {
    return apiRequest<Application>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update application
   */
  async updateApplication(
    id: string,
    data: UpdateApplicationData
  ): Promise<Application> {
    return apiRequest<Application>(`/api/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete application
   */
  async deleteApplication(id: string): Promise<void> {
    return apiRequest<void>(`/api/applications/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Regenerate SDK key
   */
  async regenerateKey(id: string): Promise<Application> {
    return apiRequest<Application>(`/api/applications/${id}/regenerate-key`, {
      method: 'POST',
    });
  },

  /**
   * Get application statistics
   */
  async getApplicationStats(id: string): Promise<ApplicationStats> {
    return apiRequest<ApplicationStats>(`/api/applications/${id}/stats`);
  },
};

export { ApiError };
