import { Logger } from '@nestjs/common';

const logger = new Logger('RetryUtils');

export interface RetryOptions {
  attempts: number;
  backoff: 'exponential' | 'linear' | 'fixed';
  initialDelay: number;
  maxDelay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  attempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
};

/**
 * Retry a function with configurable backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.attempts) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, opts);
      logger.warn(
        `Attempt ${attempt}/${opts.attempts} failed: ${lastError.message}. Retrying in ${delay}ms...`
      );

      if (opts.onRetry) {
        opts.onRetry(lastError, attempt);
      }

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  let delay: number;

  switch (options.backoff) {
    case 'exponential':
      delay = options.initialDelay * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      delay = options.initialDelay * attempt;
      break;
    case 'fixed':
    default:
      delay = options.initialDelay;
  }

  if (options.maxDelay) {
    delay = Math.min(delay, options.maxDelay);
  }

  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
