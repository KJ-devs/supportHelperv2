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
import { MetricsService } from './metrics.service';

/**
 * Metrics Interceptor
 *
 * Automatically records HTTP request metrics for Prometheus.
 * Only active when Prometheus is enabled.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(MetricsService) private readonly metricsService?: MetricsService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip if metrics service not available or disabled
    if (!this.metricsService || !this.metricsService.isEnabled()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, path } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.metricsService!.recordHttpRequest({
            method,
            path,
            statusCode,
            duration,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.metricsService!.recordHttpRequest({
            method,
            path,
            statusCode,
            duration,
          });
        },
      }),
    );
  }
}
