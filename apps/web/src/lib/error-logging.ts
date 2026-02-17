/**
 * Error logging utility
 * Centralizes error logging for the application
 * TODO: Integrate with Sentry when @sentry/nextjs is added
 */

export interface ErrorContext {
  /** Error component/page name */
  component?: string;
  /** User ID if available */
  userId?: string;
  /** Additional context */
  extra?: Record<string, unknown>;
}

/**
 * Log an error to the error tracking service
 * Currently logs to console, will be replaced with Sentry
 */
export function logError(error: Error, context?: ErrorContext): void {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
    timestamp: new Date().toISOString(),
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Logged]', errorInfo);
  }

  // TODO: Send to Sentry
  // if (typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     tags: {
  //       component: context?.component,
  //     },
  //     extra: context?.extra,
  //     user: context?.userId ? { id: context.userId } : undefined,
  //   });
  // }
}

/**
 * Log a React Error Boundary error
 */
export function logErrorBoundary(
  error: Error,
  errorInfo: React.ErrorInfo,
  context?: ErrorContext
): void {
  logError(error, {
    ...context,
    extra: {
      ...context?.extra,
      componentStack: errorInfo.componentStack,
    },
  });
}
