import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Custom exception filter for rate limiting
 *
 * Returns proper 429 Too Many Requests response with:
 * - X-RateLimit-Limit: Maximum requests allowed
 * - X-RateLimit-Remaining: Requests remaining (0 when throttled)
 * - X-RateLimit-Reset: Unix timestamp when limit resets
 * - Retry-After: Seconds until limit resets
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ThrottlerExceptionFilter.name);

  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Extract throttler context from request metadata
    const throttlerContext = (request as any).__throttler__;
    const limit = throttlerContext?.limit || 0;
    const ttl = throttlerContext?.ttl || 60000; // default 1 minute
    const resetTime = Math.ceil(Date.now() / 1000) + Math.ceil(ttl / 1000);

    // Log rate limit violation
    this.logger.warn(
      `Rate limit exceeded for ${request.method} ${request.url} - IP: ${request.ip}`,
      {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        limit,
        ttl,
      },
    );

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', 0);
    response.setHeader('X-RateLimit-Reset', resetTime);
    response.setHeader('Retry-After', Math.ceil(ttl / 1000));

    // Return 429 response
    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
      error: 'ThrottlerException',
      details: {
        limit,
        resetTime,
        retryAfter: Math.ceil(ttl / 1000),
      },
    });
  }
}
