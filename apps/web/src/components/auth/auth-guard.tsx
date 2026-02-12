'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Auth guard component that protects routes requiring authentication.
 * Redirects to login if not authenticated.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Don't redirect if still loading
    if (isLoading) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      // Store the current path to redirect back after login
      const redirectUrl = pathname !== '/' ? pathname : '/dashboard';
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Render children if authenticated
  return <>{children}</>;
}
