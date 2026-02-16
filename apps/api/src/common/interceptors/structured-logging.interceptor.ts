import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PinoLoggerService } from '../logger/pino-logger.service';

/**
 * Structured Logging Interceptor
 *
 * Logs HTTP requests with structured data including:
 * - Request method, path, status code
 * - Response time in milliseconds
 * - Request ID for correlation
 * - User agent and IP address
 *
 * Skips health check endpoints to reduce noise.
 */
@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(PinoLoggerService) private readonly logger?: PinoLoggerService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Skip if logger not available
    if (!this.logger) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, path } = request;

    // Skip health check endpoints
    if (this.shouldSkipLogging(path)) {
      return next.handle();
    }

    const userAgent = request.get('user-agent') || 'unknown';
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const requestId = (request as Request & { requestId?: string }).requestId || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          // Log based on status code
          if (statusCode >= 500) {
            this.logger!.error('HTTP Request', {
              http: {
                method,
                url,
                path,
                statusCode,
                duration,
              },
              request: {
                requestId,
                userAgent,
                ip,
              },
            });
          } else if (statusCode >= 400) {
            this.logger!.warn('HTTP Request', {
              http: {
                method,
                url,
                path,
                statusCode,
                duration,
              },
              request: {
                requestId,
                userAgent,
                ip,
              },
            });
          } else {
            this.logger!.log('HTTP Request', {
              http: {
                method,
                url,
                path,
                statusCode,
                duration,
              },
              request: {
                requestId,
                userAgent,
                ip,
              },
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger!.error('HTTP Request Error', {
            http: {
              method,
              url,
              path,
              statusCode,
              duration,
            },
            request: {
              requestId,
              userAgent,
              ip,
            },
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          });
        },
      }),
    );
  }

  /**
   * Skip logging for health check endpoints to reduce noise
   */
  private shouldSkipLogging(path: string): boolean {
    const skipPaths = ['/health', '/api/health', '/metrics', '/api/metrics'];
    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }
}
