import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

/**
 * Audit Interceptor
 *
 * Automatically logs mutation operations (POST, PUT, PATCH, DELETE)
 * Non-blocking: audit logging runs after response is sent
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Extract user from request (set by JWT guard)
        const user = request.user;

        // Skip if no user or no tenantId (e.g., public endpoints)
        if (!user?.tenantId) {
          return;
        }

        const action = this.deriveAction(method, request.route?.path || request.url);
        const resourceType = this.deriveResourceType(request.route?.path || request.url);
        const resourceId = request.params?.id;

        // Fire-and-forget audit log (non-blocking)
        this.auditService
          .log({
            tenantId: user.tenantId,
            actorId: user.userId || user.sub,
            actorType: 'user',
            action,
            resourceType,
            resourceId,
            details: {
              method,
              path: request.url,
              statusCode: 200, // Success if we reached here
            },
            ipAddress: this.extractIpAddress(request),
          })
          .catch((error) => {
            // Silently log errors - don't disrupt the response
            this.logger.error('Failed to create audit log', error);
          });
      }),
    );
  }

  /**
   * Derive action from HTTP method and path
   * Examples:
   * - POST /api/users => create_users
   * - PUT /api/users/123 => update_users
   * - DELETE /api/tickets/456 => delete_tickets
   */
  private deriveAction(method: string, path: string): string {
    const resource = this.deriveResourceType(path);
    const methodMap: Record<string, string> = {
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return `${methodMap[method]}_${resource}`;
  }

  /**
   * Derive resource type from path
   * Examples:
   * - /api/users/123 => users
   * - /api/tickets => tickets
   * - /api/audit-logs/export => audit-logs
   */
  private deriveResourceType(path: string): string {
    const parts = path
      .split('/')
      .filter((p) => p && p !== 'api' && !p.startsWith(':'));

    // Find the first non-uuid part (resource name)
    for (const part of parts) {
      // Skip UUIDs
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          part,
        )
      ) {
        continue;
      }
      return part;
    }

    return 'unknown';
  }

  /**
   * Extract IP address from request, considering proxies
   */
  private extractIpAddress(request: Record<string, unknown>): string | undefined {
    const headers = request.headers as Record<string, string | string[] | undefined> | undefined;
    const connection = request.connection as { remoteAddress?: string } | undefined;
    const xForwardedFor = headers?.['x-forwarded-for'];
    const firstForwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor?.split(',')[0]?.trim();
    return (
      (request.ip as string | undefined) ||
      firstForwarded ||
      (headers?.['x-real-ip'] as string | undefined) ||
      connection?.remoteAddress
    );
  }
}
