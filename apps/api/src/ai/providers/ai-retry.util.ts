import { Logger } from '@nestjs/common';

const logger = new Logger('AIRetry');

/**
 * HTTP status codes that should trigger a retry.
 * 429 = Rate limited, 500/502/503 = Server errors, 529 = Overloaded (Anthropic).
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 529]);

/**
 * Network error codes that should trigger a retry.
 */
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'FETCH_ERROR',
]);

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Backoff multiplier (default: 4 → delays: 1s, 4s, 16s) */
  multiplier?: number;
  /** Jitter factor ±percentage (default: 0.2 = ±20%) */
  jitter?: number;
  /** Label for log messages */
  label?: string;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  multiplier: 4,
  jitter: 0.2,
  label: 'AI call',
};

/**
 * Extract the HTTP status code from an error thrown by AI SDKs.
 * Works with Anthropic SDK (error.status), OpenAI SDK (error.status),
 * and standard fetch responses.
 */
function getErrorStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
    // Nested in error.error for some SDK wrappers
    if (e.error && typeof e.error === 'object') {
      const inner = e.error as Record<string, unknown>;
      if (typeof inner.status === 'number') return inner.status;
    }
  }
  return null;
}

/**
 * Extract the error code (e.g. ECONNRESET) from an error.
 */
function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.code === 'string') return e.code;
    if (e.cause && typeof e.cause === 'object') {
      const cause = e.cause as Record<string, unknown>;
      if (typeof cause.code === 'string') return cause.code;
    }
  }
  return null;
}

/**
 * Extract Retry-After header value (in milliseconds) from an error.
 * Anthropic SDK exposes this as error.headers['retry-after'].
 * OpenAI SDK exposes this as error.headers?.['retry-after'].
 */
function getRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  const e = error as Record<string, unknown>;

  // Try headers object (Anthropic/OpenAI SDK style)
  let retryAfter: string | undefined;
  if (e.headers && typeof e.headers === 'object') {
    const headers = e.headers as Record<string, string>;
    retryAfter = headers['retry-after'] || headers['Retry-After'];
  }

  if (!retryAfter) return null;

  // If it's a number of seconds
  const seconds = parseFloat(retryAfter);
  if (!isNaN(seconds)) {
    return Math.ceil(seconds * 1000);
  }

  // If it's an HTTP date
  const date = new Date(retryAfter).getTime();
  if (!isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

/**
 * Determine if an error is retryable.
 */
function isRetryable(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null) {
    return RETRYABLE_STATUS_CODES.has(status);
  }

  const code = getErrorCode(error);
  if (code !== null) {
    return RETRYABLE_ERROR_CODES.has(code);
  }

  // Retry on generic network errors (fetch failures, etc.)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for a given attempt with exponential backoff + jitter.
 */
function calculateDelay(attempt: number, opts: Required<RetryOptions>): number {
  const baseDelay = opts.baseDelayMs * Math.pow(opts.multiplier, attempt);
  const jitterRange = baseDelay * opts.jitter;
  const jitter = (Math.random() * 2 - 1) * jitterRange; // ±jitter%
  return Math.round(Math.max(100, baseDelay + jitter));
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry + exponential backoff.
 *
 * Retries on:
 * - HTTP 429 (rate limited), 500, 502, 503, 529 (overloaded)
 * - Network errors: ECONNRESET, ETIMEDOUT, ECONNREFUSED, etc.
 *
 * Does NOT retry on:
 * - HTTP 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found)
 * - Any other client error (4xx except 429)
 *
 * Respects Retry-After header if present.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt >= opts.maxRetries) {
        break;
      }

      // Only retry on retryable errors
      if (!isRetryable(error)) {
        logger.warn(
          `${opts.label}: non-retryable error (status=${getErrorStatus(error)}, code=${getErrorCode(error)}), failing immediately`,
        );
        throw error;
      }

      // Calculate delay — prefer Retry-After header if available
      const retryAfter = getRetryAfterMs(error);
      const calculatedDelay = calculateDelay(attempt, opts);
      const delayMs = retryAfter !== null ? Math.max(retryAfter, calculatedDelay) : calculatedDelay;

      const status = getErrorStatus(error);
      const code = getErrorCode(error);
      const errorInfo = status ? `status=${status}` : `code=${code}`;

      logger.warn(
        `${opts.label}: attempt ${attempt + 1}/${opts.maxRetries + 1} failed (${errorInfo}), ` +
          `retrying in ${delayMs}ms${retryAfter !== null ? ' (Retry-After)' : ''}`,
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}
