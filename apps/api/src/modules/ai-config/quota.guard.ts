import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { QuotaService } from './quota.service';

/**
 * Guard that enforces per-tenant AI quota limits.
 *
 * Apply with @UseGuards(QuotaGuard) on controller methods that trigger AI calls.
 * Must be placed AFTER JwtAuthGuard (or SdkKeyGuard) so that request.user is populated.
 *
 * BYOK tenants always pass through regardless of usage.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(private readonly quotaService: QuotaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: { tenantId?: string };
      tenant?: { id?: string };
    }>();

    // Support both JWT (request.user.tenantId) and SDK key (request.tenant.id) flows
    const tenantId = request.user?.tenantId ?? request.tenant?.id;

    if (!tenantId) {
      this.logger.warn('QuotaGuard: no tenantId found on request');
      // Let it pass — quota check requires a tenant; auth guards handle authentication
      return true;
    }

    const result = await this.quotaService.checkQuota(tenantId);

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: result.reason ?? 'AI quota exceeded',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
