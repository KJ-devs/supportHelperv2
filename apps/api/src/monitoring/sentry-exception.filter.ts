import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { SentryService } from './sentry.service';
import { getCorrelationId } from './logger.service';

@Catch()
@Injectable()
export class SentryExceptionFilter implements ExceptionFilter {
  constructor(private readonly sentry: SentryService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const correlationId = getCorrelationId();

    // Only send to Sentry for 5xx errors (server errors)
    if (status >= 500 && this.sentry.isInitialized()) {
      Sentry.withScope((scope) => {
        scope.setExtra('correlationId', correlationId);
        scope.setExtra('url', request.url);
        scope.setExtra('method', request.method);
        scope.setExtra('statusCode', status);
        scope.setExtra('userAgent', request.headers['user-agent']);

        // Set user context if available
        const user = (request as Request & { user?: { id: string; tenantId?: string } }).user;
        if (user) {
          scope.setUser({
            id: user.id,
            tenantId: user.tenantId,
          } as Sentry.User);
        }

        // Set tags for filtering
        scope.setTag('correlationId', correlationId);
        scope.setTag('url', request.url);
        scope.setTag('method', request.method);

        if (exception instanceof Error) {
          Sentry.captureException(exception);
        } else {
          Sentry.captureMessage(String(exception), 'error');
        }
      });
    }

    // Add breadcrumb for 4xx errors
    if (status >= 400 && status < 500 && this.sentry.isInitialized()) {
      Sentry.addBreadcrumb({
        category: 'http',
        message: `${request.method} ${request.url} - ${status}`,
        level: 'warning',
        data: {
          correlationId,
          statusCode: status,
        },
      });
    }

    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
    };

    // Include validation errors if available
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const { message: _, ...rest } = exceptionResponse as Record<string, unknown>;
        Object.assign(errorResponse, rest);
      }
    }

    response.status(status).json(errorResponse);
  }
}
