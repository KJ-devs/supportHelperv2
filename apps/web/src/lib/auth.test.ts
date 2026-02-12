import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auth, getAuthErrorMessage } from './auth';
import { ApiError } from './api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

describe('Auth', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should store session data', () => {
      const mockResponse = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        user: {
          id: '1',
          tenantId: 'tenant-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin' as const,
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      auth.setSession(mockResponse);

      expect(localStorageMock.getItem('accessToken')).toBe('access-token-123');
      expect(localStorageMock.getItem('refreshToken')).toBe('refresh-token-456');
      expect(JSON.parse(localStorageMock.getItem('user') || '{}')).toEqual(mockResponse.user);
    });

    it('should clear session data', () => {
      localStorageMock.setItem('accessToken', 'token');
      localStorageMock.setItem('refreshToken', 'refresh');
      localStorageMock.setItem('user', '{"id":"1"}');

      auth.clearSession();

      expect(localStorageMock.getItem('accessToken')).toBeNull();
      expect(localStorageMock.getItem('refreshToken')).toBeNull();
      expect(localStorageMock.getItem('user')).toBeNull();
    });

    it('should check if user is authenticated', () => {
      expect(auth.isAuthenticated()).toBe(false);

      localStorageMock.setItem('accessToken', 'token');
      expect(auth.isAuthenticated()).toBe(true);

      auth.clearSession();
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('should get stored user data', () => {
      const user = {
        id: '1',
        tenantId: 'tenant-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as const,
        createdAt: '2024-01-01T00:00:00Z',
      };

      localStorageMock.setItem('user', JSON.stringify(user));

      expect(auth.getUser()).toEqual(user);
    });
  });

  describe('Token Parsing', () => {
    it('should parse a valid JWT token', () => {
      // Create a mock JWT token with exp claim
      const payload = { exp: Math.floor(Date.now() / 1000) + 3600 }; // Expires in 1 hour
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const parsed = auth.parseToken(token);
      expect(parsed).toBeTruthy();
      expect(parsed?.exp).toBe(payload.exp);
    });

    it('should return null for invalid token', () => {
      expect(auth.parseToken('invalid')).toBeNull();
      expect(auth.parseToken('')).toBeNull();
    });

    it('should check if token is expired', () => {
      // Expired token (exp in the past)
      const expiredPayload = { exp: Math.floor(Date.now() / 1000) - 3600 };
      const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;
      expect(auth.isTokenExpired(expiredToken)).toBe(true);

      // Valid token (exp in the future)
      const validPayload = { exp: Math.floor(Date.now() / 1000) + 3600 };
      const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
      expect(auth.isTokenExpired(validToken)).toBe(false);

      // Token expiring within 60 seconds should be considered expired
      const soonPayload = { exp: Math.floor(Date.now() / 1000) + 30 };
      const soonToken = `header.${btoa(JSON.stringify(soonPayload))}.signature`;
      expect(auth.isTokenExpired(soonToken)).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should return user-friendly error messages', () => {
      expect(getAuthErrorMessage(new ApiError(401, 'Unauthorized'))).toBe(
        'Invalid email or password'
      );
      expect(getAuthErrorMessage(new ApiError(409, 'Conflict'))).toBe(
        'An account with this email already exists'
      );
      expect(getAuthErrorMessage(new ApiError(400, 'Bad request'))).toBe('Bad request');
      expect(getAuthErrorMessage(new ApiError(500, 'Server error'))).toBe('Server error');
      expect(getAuthErrorMessage(new Error('Network error'))).toBe('Network error');
      expect(getAuthErrorMessage('Unknown error')).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });
  });
});
