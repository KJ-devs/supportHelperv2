import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logging interceptor
 * Logs all incoming requests and response times
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    this.logger.log(
      `→ ${method} ${url} ${userAgent}${
        Object.keys(body || {}).length ? ` [Body: ${JSON.stringify(body)}]` : ''
      }`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const contentLength = response.get('content-length') || 0;
          const elapsedTime = Date.now() - startTime;

          this.logger.log(
            `← ${method} ${url} ${statusCode} ${contentLength}b - ${elapsedTime}ms`,
          );
        },
        error: (error) => {
          const elapsedTime = Date.now() - startTime;
          this.logger.error(
            `✗ ${method} ${url} ${error.status || 500} - ${elapsedTime}ms`,
          );
        },
      }),
    );
  }
}
