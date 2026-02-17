import { Inject, Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerOptions, ThrottlerStorage } from '@nestjs/throttler';
import { UserEntity, ApplicationEntity } from '../dto/auth.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RATE_LIMIT_PRESETS, RateLimitConfig } from '../../../tenants/dto/update-rate-limits.dto';

/**
 * Tenant-Aware Rate Limiting Guard with Configurable Limits
 *
 * Rate limits requests per tenant based on their plan or custom configuration.
 * Supports both per-minute and per-hour rate limiting.
 *
 * Features:
 * - Reads tenant-specific rate limits from database
 * - Falls back to plan-based presets (free, pro, enterprise)
 * - Supports both authenticated users and SDK key authentication
 * - Caches tenant config per request to avoid multiple DB calls
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantRateLimitGuard)
 * @Post('tickets')
 * createTicket() { ... }
 */
@Injectable()
export class TenantRateLimitGuard extends ThrottlerGuard {
  private tenantConfigCache = new Map<string, { config: RateLimitConfig; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(
    @Inject('THROTTLER_OPTIONS') options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Get throttler options for a tenant
   * Reads from database or cache
   */
  protected async getThrottlerOptions(context: ExecutionContext): Promise<ThrottlerOptions[]> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserEntity | ApplicationEntity;

    if (!user?.tenantId) {
      // Fallback to default limits for unauthenticated requests
      return [
        { name: 'default', ttl: 60000, limit: 10 },
      ];
    }

    // Get tenant rate limits
    const rateLimits = await this.getTenantRateLimits(user.tenantId);

    // Return both minute and hour throttlers
    return [
      {
        name: 'per-minute',
        ttl: 60000, // 1 minute in ms
        limit: rateLimits.requestsPerMinute,
      },
      {
        name: 'per-hour',
        ttl: 3600000, // 1 hour in ms
        limit: rateLimits.requestsPerHour,
      },
    ];
  }

  /**
   * Get tenant rate limits from cache or database
   */
  private async getTenantRateLimits(tenantId: string): Promise<RateLimitConfig> {
    // Check cache
    const cached = this.tenantConfigCache.get(tenantId);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.config;
    }

    // Fetch from database
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true, plan: true },
    });

    if (!tenant) {
      // Fallback to default if tenant not found
      return RATE_LIMIT_PRESETS.default;
    }

    const settings = tenant.settings as Record<string, unknown>;
    let config: RateLimitConfig;

    // Check if tenant has custom rate limits
    if (settings?.rateLimits && typeof settings.rateLimits === 'object') {
      const limits = settings.rateLimits as RateLimitConfig;
      config = {
        requestsPerMinute: limits.requestsPerMinute,
        requestsPerHour: limits.requestsPerHour,
      };
    } else {
      // Fall back to plan-based presets
      config = RATE_LIMIT_PRESETS[tenant.plan] || RATE_LIMIT_PRESETS.default;
    }

    // Update cache
    this.tenantConfigCache.set(tenantId, { config, timestamp: now });

    // Clean up old cache entries (simple LRU)
    if (this.tenantConfigCache.size > 1000) {
      const oldestKey = this.tenantConfigCache.keys().next().value;
      this.tenantConfigCache.delete(oldestKey);
    }

    return config;
  }

  /**
   * Generate rate limit key based on tenantId instead of IP
   */
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserEntity | ApplicationEntity;

    // Use tenantId as the rate limit key if available
    if (user?.tenantId) {
      return `tenant:${user.tenantId}:${name}:${suffix}`;
    }

    // Fallback to default behavior (IP-based)
    return super.generateKey(context, suffix, name);
  }
}
