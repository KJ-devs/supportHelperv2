import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Throttler Exception Filter
 *
 * Handles rate limit exceeded exceptions:
 * - Returns 429 status code
 * - Adds rate limit headers
 * - Logs events to Sentry
 */
@Catch(HttpException)
@Injectable()
export class ThrottlerExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ThrottlerExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    // Only handle throttler exceptions (429)
    if (status !== HttpStatus.TOO_MANY_REQUESTS) {
      // Let default exception filter handle it
      throw exception;
    }

    // Extract rate limit info from exception response
    const exceptionResponse = exception.getResponse() as any;
    const message = exceptionResponse.message || 'Too Many Requests';

    // Log to Sentry
    Sentry.captureEvent({
      message: 'Rate limit exceeded',
      level: 'warning',
      tags: {
        endpoint: request.path,
        method: request.method,
        ip: request.ip,
      },
      extra: {
        headers: request.headers,
        limit: exceptionResponse.limit,
        ttl: exceptionResponse.ttl,
      },
    });

    // Log locally
    this.logger.warn(
      `Rate limit exceeded: ${request.method} ${request.path} from ${request.ip}`,
      {
        limit: exceptionResponse.limit,
        ttl: exceptionResponse.ttl,
      },
    );

    // Send response with rate limit headers
    response.status(status).json({
      statusCode: status,
      error: 'Too Many Requests',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
