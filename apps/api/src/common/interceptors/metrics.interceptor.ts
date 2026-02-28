import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../../monitoring/metrics.service';

/**
 * Interceptor that automatically records Prometheus metrics for all HTTP requests.
 * Tracks request count, duration, status codes, and errors.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.metricsService.isEnabled()) {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    this.metricsService.httpRequestsInFlight.inc();

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(request, response, startTime);
        },
        error: (error) => {
          this.recordMetrics(request, response, startTime, error);
        },
      }),
    );
  }

  private recordMetrics(
    request: Request,
    response: Response,
    startTime: number,
    error?: { status?: number; constructor?: { name?: string }; code?: string },
  ): void {
    const durationSeconds = (Date.now() - startTime) / 1000;
    const method = request.method;
    const route = this.getRoute(request);
    const statusCode = error ? error.status || 500 : response.statusCode;
    const tenantId = (request as Request & { user?: { tenantId?: string } }).user?.tenantId;

    this.metricsService.httpRequestsInFlight.dec();
    this.metricsService.recordHttpRequest(method, route, statusCode, durationSeconds, tenantId);

    // Record errors
    if (error) {
      const errorType = error.constructor?.name || 'Error';
      const errorCode = error.code || 'UNKNOWN';
      this.metricsService.recordError(errorType, errorCode, route);
    }
  }

  /**
   * Extract route pattern from request (e.g., /api/tickets/:id instead of /api/tickets/123)
   */
  private getRoute(request: Request): string {
    // Try to get the route from Express
    if (request.route?.path) {
      return request.route.path;
    }

    // Fallback: normalize the path to avoid high cardinality
    // Replace UUIDs and numeric IDs with :id
    return request.path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
