import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserEntity, ApplicationEntity } from '../dto/auth.dto';

/**
 * Tenant-Aware Rate Limiting Guard
 *
 * Rate limits requests per tenant instead of per IP
 * Useful for API key authentication where multiple requests
 * may come from the same IP but different tenants
 *
 * Usage:
 * @UseGuards(ApiKeyGuard, TenantRateLimitGuard)
 * @Throttle({ default: { limit: 100, ttl: 60000 } })
 * @Post('sdk/tickets')
 * createTicket() { ... }
 */
@Injectable()
export class TenantRateLimitGuard extends ThrottlerGuard {
  /**
   * Generate rate limit key based on tenantId instead of IP
   */
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserEntity | ApplicationEntity;

    // Use tenantId as the rate limit key if available
    if (user?.tenantId) {
      return `${user.tenantId}-${name}-${suffix}`;
    }

    // Fallback to default behavior (IP-based)
    return super.generateKey(context, suffix, name);
  }
}
