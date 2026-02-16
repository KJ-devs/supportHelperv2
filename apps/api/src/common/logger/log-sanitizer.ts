/**
 * Log Sanitization Utility
 *
 * Redacts sensitive fields from log objects to prevent credential leaks
 */

const SENSITIVE_FIELDS = [
  'password',
  'api_key',
  'apiKey',
  'token',
  'secret',
  'authorization',
  'x-sdk-key',
  'credit_card',
  'creditCard',
  'ssn',
  'privateKey',
  'private_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'sessionId',
  'session_id',
  'cookie',
  'cookies',
];

const REDACTED = '[REDACTED]';

/**
 * Deep traversal to redact sensitive fields from an object
 */
export function sanitizeLogObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeLogObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if this field should be redacted
      const shouldRedact = SENSITIVE_FIELDS.some(field =>
        lowerKey.includes(field.toLowerCase())
      );

      if (shouldRedact) {
        sanitized[key] = REDACTED;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeLogObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Pino redact configuration
 * Returns paths to redact in pino logs
 */
export function getPinoRedactPaths(): string[] {
  return SENSITIVE_FIELDS.map(field => `*.${field}`);
}
