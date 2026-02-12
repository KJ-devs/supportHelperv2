const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
  skipAuth?: boolean; // Skip automatic token refresh
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Track if we're currently refreshing to avoid multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, skipAuth, ...fetchOptions } = options;

  // Build URL
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Get token from localStorage
  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  };

  // Check if we need to refresh the token
  if (!skipAuth && typeof window !== 'undefined' && endpoint !== '/api/auth/refresh') {
    const token = getToken();
    if (token) {
      const needsRefresh = isTokenExpired(token);
      if (needsRefresh) {
        // If already refreshing, wait for it to complete
        if (isRefreshing && refreshPromise) {
          await refreshPromise;
        } else {
          // Start a new refresh
          isRefreshing = true;
          refreshPromise = refreshToken().finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
          await refreshPromise;
        }
      }
    }
  }

  // Make the request with current token
  const token = getToken();
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    },
  });

  // Handle error responses
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, error.message || 'Request failed');
  }

  // Handle empty responses
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

/**
 * Check if a JWT token is expired or about to expire (within 60 seconds)
 */
function isTokenExpired(token: string): boolean {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return true;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return true;

    // Check if token expires within 60 seconds
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    return expiresAt - now < 60000;
  } catch {
    return true;
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshToken(): Promise<void> {
  if (typeof window === 'undefined') return;

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    // Update tokens in localStorage
    localStorage.setItem('accessToken', data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  } catch (error) {
    // If refresh fails, clear session and redirect to login
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');

    // Redirect to login if not already there
    if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/register')) {
      window.location.href = '/login';
    }

    throw error;
  }
}

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};
