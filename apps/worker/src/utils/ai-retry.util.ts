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

export interface AIRetryOptions {
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

const DEFAULT_OPTIONS: Required<AIRetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  multiplier: 4,
  jitter: 0.2,
  label: 'AI call',
};

function getErrorStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (e.error && typeof e.error === 'object') {
      const inner = e.error as Record<string, unknown>;
      if (typeof inner.status === 'number') return inner.status;
    }
  }
  return null;
}

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

function getRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as Record<string, unknown>;
  let retryAfter: string | undefined;
  if (e.headers && typeof e.headers === 'object') {
    const headers = e.headers as Record<string, string>;
    retryAfter = headers['retry-after'] || headers['Retry-After'];
  }
  if (!retryAfter) return null;
  const seconds = parseFloat(retryAfter);
  if (!isNaN(seconds)) return Math.ceil(seconds * 1000);
  const date = new Date(retryAfter).getTime();
  if (!isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function isRetryable(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== null) return RETRYABLE_STATUS_CODES.has(status);
  const code = getErrorCode(error);
  if (code !== null) return RETRYABLE_ERROR_CODES.has(code);
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  return false;
}

function calculateDelay(attempt: number, opts: Required<AIRetryOptions>): number {
  const baseDelay = opts.baseDelayMs * Math.pow(opts.multiplier, attempt);
  const jitterRange = baseDelay * opts.jitter;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.round(Math.max(100, baseDelay + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry + exponential backoff.
 *
 * Retries on: 429, 500, 502, 503, 529, network errors.
 * Does NOT retry on: 400, 401, 403 (client errors).
 * Respects Retry-After header if present.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: AIRetryOptions,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= opts.maxRetries) break;
      if (!isRetryable(error)) {
        logger.warn(
          `${opts.label}: non-retryable error (status=${getErrorStatus(error)}, code=${getErrorCode(error)}), failing immediately`,
        );
        throw error;
      }
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
