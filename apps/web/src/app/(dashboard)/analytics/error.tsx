'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/error-logging';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to error tracking service
    logError(error, {
      component: 'AnalyticsError',
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Failed to load analytics</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || 'There was a problem loading the analytics data.'}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
