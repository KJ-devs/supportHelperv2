import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  auth,
  type LoginCredentials,
  type RegisterCredentials,
  type AuthResponse,
  getAuthErrorMessage,
} from '../auth';

/**
 * Query key for authentication queries
 */
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

/**
 * Hook to get the current authenticated user
 */
export function useUser() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => auth.getMe(),
    enabled: auth.isAuthenticated(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

/**
 * Hook for login mutation with automatic redirect
 */
export function useLogin(redirectUrl?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => auth.login(credentials),
    onSuccess: (data: AuthResponse) => {
      // Update the user query cache
      queryClient.setQueryData(authKeys.me(), data.user);

      // Redirect to the specified URL or dashboard
      router.push(redirectUrl || '/dashboard');
    },
    onError: (error) => {
      console.error('Login failed:', getAuthErrorMessage(error));
    },
  });
}

/**
 * Hook for registration mutation with automatic redirect
 */
export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) => auth.register(credentials),
    onSuccess: (data: AuthResponse) => {
      // Update the user query cache
      queryClient.setQueryData(authKeys.me(), data.user);

      // Redirect to dashboard
      router.push('/dashboard');
    },
    onError: (error) => {
      console.error('Registration failed:', getAuthErrorMessage(error));
    },
  });
}

/**
 * Hook for logout mutation with automatic redirect
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();

      // Redirect to login
      router.push('/login');
    },
  });
}

/**
 * Hook for token refresh mutation
 */
export function useRefreshToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auth.refresh(),
    onSuccess: (data: AuthResponse) => {
      // Update the user query cache
      queryClient.setQueryData(authKeys.me(), data.user);
    },
    onError: () => {
      // Clear session and redirect to login
      auth.clearSession();
      queryClient.clear();
      window.location.href = '/login';
    },
  });
}

/**
 * Hook to check authentication status and get user data
 */
export function useAuth() {
  const { data: user, isLoading, error } = useUser();
  const logout = useLogout();

  return {
    user,
    isLoading,
    isAuthenticated: !!user && auth.isAuthenticated(),
    error,
    logout: logout.mutate,
  };
}
