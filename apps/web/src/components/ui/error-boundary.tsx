'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { logErrorBoundary } from '@/lib/error-logging';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Compact mode for inline/widget error states */
  compact?: boolean;
  /** Component name for error logging context */
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking service (Sentry)
    logErrorBoundary(error, errorInfo, {
      component: this.props.componentName,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.compact) {
        return (
          <CompactErrorFallback
            error={this.state.error}
            onRetry={this.handleRetry}
          />
        );
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

export function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Something went wrong</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function CompactErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Failed to load</p>
        <p className="text-xs text-muted-foreground truncate">
          {error?.message || 'An unexpected error occurred'}
        </p>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
