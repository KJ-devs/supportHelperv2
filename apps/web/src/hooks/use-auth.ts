import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = '/api';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'user';
  avatar?: string;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Query keys
export const authKeys = {
  user: ['auth', 'user'] as const,
};

// Fetch functions
async function fetchCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/me`);
  if (!response.ok) throw new Error('Not authenticated');
  return response.json();
}

async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }
  return response.json();
}

async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }
  return response.json();
}

async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Logout failed');
}

// Hooks
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.user,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: login,
    onSuccess: data => {
      // Store tokens - in production, use httpOnly cookies
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: register,
    onSuccess: data => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    },
  });
}
