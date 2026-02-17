'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { logError } from '@/lib/error-logging';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to error tracking service
    logError(error, {
      component: 'DashboardError',
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
