import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Rate Limit Logging Interceptor
 *
 * Logs warnings when a client is approaching rate limits
 * (when remaining requests < 10).
 *
 * Useful for monitoring and alerting on potential abuse.
 */
@Injectable()
export class RateLimitLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitLoggingInterceptor.name);
  private readonly warningThreshold = 10;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const remaining = response.getHeader('X-RateLimit-Remaining');
        const limit = response.getHeader('X-RateLimit-Limit');

        if (
          remaining !== undefined &&
          limit !== undefined &&
          typeof remaining === 'string' &&
          typeof limit === 'string'
        ) {
          const remainingNum = parseInt(remaining, 10);
          const limitNum = parseInt(limit, 10);

          if (
            !isNaN(remainingNum) &&
            !isNaN(limitNum) &&
            remainingNum < this.warningThreshold &&
            remainingNum > 0
          ) {
            this.logger.warn(
              `Client approaching rate limit: ${remainingNum}/${limitNum} remaining`,
              {
                method: request.method,
                url: request.url,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                remaining: remainingNum,
                limit: limitNum,
              },
            );
          }
        }
      }),
    );
  }
}
