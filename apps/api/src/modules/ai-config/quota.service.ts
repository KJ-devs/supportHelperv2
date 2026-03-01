import { Injectable, Logger } from '@nestjs/common';
import { TenantQuota } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateQuotaDto } from './dto/update-quota.dto';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface QuotaStatus {
  plan: string;
  monthlyQuota: number;
  currentUsage: number;
  remaining: number;
  isByok: boolean;
  resetsAt: Date;
}

/** Returns the 1st day of the next calendar month at 00:00 UTC. */
function nextMonthReset(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lazily creates a TenantQuota record with free-tier defaults if none exists.
   */
  async ensureQuotaExists(tenantId: string): Promise<TenantQuota> {
    const existing = await this.prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    if (existing) {
      return existing;
    }

    this.logger.log(`Creating default quota record for tenant ${tenantId}`);

    return this.prisma.tenantQuota.create({
      data: {
        tenantId,
        plan: 'free',
        monthlyQuota: 10,
        currentUsage: 0,
        quotaResetAt: nextMonthReset(),
        isByok: false,
      },
    });
  }

  /**
   * Auto-resets usage if quotaResetAt has passed, then re-fetches the record.
   */
  async resetQuotaIfNeeded(tenantId: string): Promise<void> {
    const quota = await this.prisma.tenantQuota.findUnique({
      where: { tenantId },
    });

    if (!quota) {
      return;
    }

    if (new Date() >= quota.quotaResetAt) {
      this.logger.log(`Resetting quota for tenant ${tenantId}`);
      await this.prisma.tenantQuota.update({
        where: { tenantId },
        data: {
          currentUsage: 0,
          quotaResetAt: nextMonthReset(),
        },
      });
    }
  }

  /**
   * Returns whether the tenant is allowed to make an AI call.
   *
   * Rules:
   * - BYOK tenants → always allowed
   * - Usage >= monthlyQuota → denied with 429-friendly message
   * - Otherwise → allowed
   */
  async checkQuota(tenantId: string): Promise<QuotaCheckResult> {
    const quota = await this.ensureQuotaExists(tenantId);

    // Auto-reset if the period has elapsed
    if (new Date() >= quota.quotaResetAt) {
      await this.resetQuotaIfNeeded(tenantId);
      // Refresh after reset
      const refreshed = await this.prisma.tenantQuota.findUnique({
        where: { tenantId },
      });
      if (refreshed) {
        return this.evaluateQuota(refreshed);
      }
    }

    return this.evaluateQuota(quota);
  }

  private evaluateQuota(quota: TenantQuota): QuotaCheckResult {
    if (quota.isByok) {
      return { allowed: true };
    }

    if (quota.currentUsage >= quota.monthlyQuota) {
      return {
        allowed: false,
        reason: `Monthly AI analysis quota exceeded (${quota.currentUsage}/${quota.monthlyQuota}). Upgrade your plan or configure your own AI key (BYOK) to continue.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Increments the current usage counter by 1 after a successful AI call.
   */
  async incrementUsage(tenantId: string): Promise<void> {
    await this.ensureQuotaExists(tenantId);

    await this.prisma.tenantQuota.update({
      where: { tenantId },
      data: {
        currentUsage: { increment: 1 },
      },
    });
  }

  /**
   * Returns the current quota status for a tenant (used by the API endpoint).
   */
  async getQuotaStatus(tenantId: string): Promise<QuotaStatus> {
    const quota = await this.ensureQuotaExists(tenantId);

    // Auto-reset if needed before reporting
    if (new Date() >= quota.quotaResetAt) {
      await this.resetQuotaIfNeeded(tenantId);
      const refreshed = await this.prisma.tenantQuota.findUnique({
        where: { tenantId },
      });
      if (refreshed) {
        return this.toQuotaStatus(refreshed);
      }
    }

    return this.toQuotaStatus(quota);
  }

  private toQuotaStatus(quota: TenantQuota): QuotaStatus {
    const remaining = quota.isByok
      ? Infinity
      : Math.max(0, quota.monthlyQuota - quota.currentUsage);

    return {
      plan: quota.plan,
      monthlyQuota: quota.monthlyQuota,
      currentUsage: quota.currentUsage,
      remaining: remaining === Infinity ? -1 : remaining, // -1 signals unlimited
      isByok: quota.isByok,
      resetsAt: quota.quotaResetAt,
    };
  }

  /**
   * Updates quota settings for a tenant (admin use — plan changes, BYOK flag, etc.).
   */
  async updateQuota(tenantId: string, dto: UpdateQuotaDto): Promise<QuotaStatus> {
    const quota = await this.ensureQuotaExists(tenantId);

    const data: Partial<{
      plan: string;
      monthlyQuota: number;
      isByok: boolean;
    }> = {};

    if (dto.plan !== undefined) {
      data.plan = dto.plan;
      // Apply default quota limits for known plans when not explicitly set
      if (dto.monthlyQuota === undefined) {
        data.monthlyQuota = this.defaultQuotaForPlan(dto.plan);
      }
    }

    if (dto.monthlyQuota !== undefined) {
      data.monthlyQuota = dto.monthlyQuota;
    }

    if (dto.isByok !== undefined) {
      data.isByok = dto.isByok;
    }

    const updated = await this.prisma.tenantQuota.update({
      where: { tenantId: quota.tenantId },
      data,
    });

    return this.toQuotaStatus(updated);
  }

  private defaultQuotaForPlan(plan: string): number {
    switch (plan) {
      case 'free':
        return 10;
      case 'pro':
        return 500;
      case 'enterprise':
        return 5000;
      default:
        return 10;
    }
  }
}
