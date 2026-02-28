import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateSlug } from '@support-helper/shared';
import { RateLimitConfig, RATE_LIMIT_PRESETS } from './dto/update-rate-limits.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; slug?: string }) {
    let slug = data.slug || generateSlug(data.name);

    // Ensure slug is unique
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      // Append random suffix
      slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        plan: 'free',
        settings: {},
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, data: { name?: string; settings?: Record<string, unknown> }) {
    const tenant = await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: data.name,
        settings: data.settings ? (data.settings as Prisma.InputJsonValue) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async updatePlan(id: string, plan: string) {
    const tenant = await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan },
    });
  }

  async getStats(id: string) {
    const tenant = await this.findOne(id);

    const [usersCount, appsCount, ticketsCount, openTicketsCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id } }),
      this.prisma.application.count({ where: { tenantId: id } }),
      this.prisma.ticket.count({ where: { tenantId: id } }),
      this.prisma.ticket.count({
        where: {
          tenantId: id,
          status: { in: ['new', 'open', 'in_progress', 'analyzing'] },
        },
      }),
    ]);

    return {
      tenant,
      stats: {
        users: usersCount,
        applications: appsCount,
        tickets: ticketsCount,
        openTickets: openTicketsCount,
      },
    };
  }

  /**
   * Get rate limit configuration for a tenant
   * Returns tenant-specific limits or plan-based defaults
   */
  async getRateLimits(tenantId: string): Promise<RateLimitConfig> {
    const tenant = await this.findOne(tenantId);
    const settings = tenant.settings as Record<string, unknown>;

    // Check if tenant has custom rate limits
    if (settings?.rateLimits && typeof settings.rateLimits === 'object') {
      const limits = settings.rateLimits as RateLimitConfig;
      return {
        requestsPerMinute: limits.requestsPerMinute,
        requestsPerHour: limits.requestsPerHour,
      };
    }

    // Fall back to plan-based presets
    const preset = RATE_LIMIT_PRESETS[tenant.plan] || RATE_LIMIT_PRESETS.default;
    return preset;
  }

  /**
   * Update rate limit configuration for a tenant
   * Admin-only operation
   */
  async updateRateLimits(
    tenantId: string,
    limits: Partial<RateLimitConfig>,
  ): Promise<RateLimitConfig> {
    const tenant = await this.findOne(tenantId);
    const currentLimits = await this.getRateLimits(tenantId);

    // Merge with existing limits
    const newLimits: RateLimitConfig = {
      requestsPerMinute: limits.requestsPerMinute ?? currentLimits.requestsPerMinute,
      requestsPerHour: limits.requestsPerHour ?? currentLimits.requestsPerHour,
    };

    // Update tenant settings
    const settings = (tenant.settings as Record<string, unknown>) || {};
    settings.rateLimits = newLimits;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: settings as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return newLimits;
  }

  /**
   * Reset rate limits to plan-based defaults
   */
  async resetRateLimits(tenantId: string): Promise<RateLimitConfig> {
    const tenant = await this.findOne(tenantId);
    const preset = RATE_LIMIT_PRESETS[tenant.plan] || RATE_LIMIT_PRESETS.default;

    const settings = (tenant.settings as Record<string, unknown>) || {};
    settings.rateLimits = preset;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: settings as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return preset;
  }
}
