import { api, ApiError } from './api';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  tenantName: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication manager for the web app.
 * Handles token storage, refresh, and user session management.
 */
export const auth = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', credentials);
    this.setSession(response);
    return response;
  },

  /**
   * Register a new user and tenant
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/register', credentials);
    this.setSession(response);
    return response;
  },

  /**
   * Logout the current user
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint (optional - JWT is stateless)
      await api.post('/api/auth/logout');
    } catch (error) {
      // Ignore errors on logout
      console.error('Logout error:', error);
    } finally {
      this.clearSession();
    }
  },

  /**
   * Refresh the access token using the refresh token
   */
  async refresh(): Promise<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await api.post<AuthResponse>('/api/auth/refresh', {
        refreshToken,
      });
      this.setSession(response);
      return response;
    } catch (error) {
      // If refresh fails, clear the session
      this.clearSession();
      throw error;
    }
  },

  /**
   * Get the current user info from the API
   */
  async getMe(): Promise<User> {
    return api.get<User>('/api/auth/me');
  },

  /**
   * Store authentication tokens and user data
   */
  setSession(response: AuthResponse): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    if (response.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    }
    if (response.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
  },

  /**
   * Clear all authentication data
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Get the stored access token
   */
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * Get the stored refresh token
   */
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Get the stored user data
   */
  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  },

  /**
   * Check if the user is authenticated (has a token)
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  /**
   * Parse JWT token to check expiration
   * Returns null if token is invalid or expired
   */
  parseToken(token: string): { exp: number } | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  },

  /**
   * Check if the access token is expired or about to expire (within 60 seconds)
   */
  isTokenExpired(token?: string): boolean {
    const accessToken = token || this.getAccessToken();
    if (!accessToken) return true;

    const payload = this.parseToken(accessToken);
    if (!payload || !payload.exp) return true;

    // Check if token expires within 60 seconds
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    return expiresAt - now < 60000;
  },

  /**
   * Attempt to refresh the token if expired
   * Returns true if refresh was successful or not needed
   */
  async ensureValidToken(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (this.isTokenExpired()) {
      try {
        await this.refresh();
        return true;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      }
    }

    return true;
  },
};

/**
 * Get a user-friendly error message from API errors
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return 'Invalid email or password';
      case 409:
        return 'An account with this email already exists';
      case 400:
        return error.message || 'Invalid request. Please check your information.';
      default:
        return error.message || 'An error occurred. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
