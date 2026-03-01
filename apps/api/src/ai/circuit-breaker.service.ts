import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

/** Default daily budget limit in USD when none is configured */
const DEFAULT_DAILY_BUDGET_USD = 50;

/** TTL for circuit-breaker Redis keys: 48 hours in seconds */
const CIRCUIT_TTL_SECONDS = 48 * 60 * 60;

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class AiCircuitBreakerService {
  private readonly logger = new Logger(AiCircuitBreakerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Build the Redis key for the circuit breaker cost accumulator.
   * Format: ai:circuit:{tenantId}:{YYYY-MM-DD}
   */
  private buildKey(tenantId: string): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `ai:circuit:${tenantId}:${today}`;
  }

  /**
   * Get the daily budget limit for a tenant.
   * Reads from AiConfig.settings.dailyBudgetLimit, falls back to $50 default.
   * Returns null if no limit should be applied (unlimited).
   */
  async getBudgetLimit(tenantId: string): Promise<number | null> {
    try {
      const config = await this.prisma.aiConfig.findUnique({
        where: { tenantId },
        select: { settings: true },
      });

      if (!config) {
        return DEFAULT_DAILY_BUDGET_USD;
      }

      const settings = config.settings as Record<string, unknown> | null;

      if (settings && 'dailyBudgetLimit' in settings) {
        const limit = settings['dailyBudgetLimit'];
        if (limit === null) {
          return null; // Explicitly unlimited
        }
        if (typeof limit === 'number' && limit > 0) {
          return limit;
        }
      }

      return DEFAULT_DAILY_BUDGET_USD;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch budget limit for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return DEFAULT_DAILY_BUDGET_USD;
    }
  }

  /**
   * Get the current daily spending for a tenant from Redis.
   * Returns 0 if no spending has been recorded today.
   */
  async getDailySpending(tenantId: string): Promise<number> {
    try {
      const key = this.buildKey(tenantId);
      const value = await this.cache.get<number>(key);
      return value ?? 0;
    } catch (error) {
      this.logger.warn(
        `Failed to get daily spending for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /**
   * Check whether an AI call is allowed for a tenant given the estimated cost.
   * Returns { allowed: true } if within budget, or { allowed: false, reason: '...' } if exceeded.
   */
  async checkBudget(
    tenantId: string,
    estimatedCost: number,
  ): Promise<BudgetCheckResult> {
    try {
      const [currentSpending, limit] = await Promise.all([
        this.getDailySpending(tenantId),
        this.getBudgetLimit(tenantId),
      ]);

      // Null limit means explicitly unlimited
      if (limit === null) {
        return { allowed: true };
      }

      if (currentSpending + estimatedCost > limit) {
        this.logger.warn(
          `Budget exceeded for tenant ${tenantId}: spending=$${currentSpending.toFixed(4)}, estimated=$${estimatedCost.toFixed(4)}, limit=$${limit}`,
        );
        return {
          allowed: false,
          reason: `Daily AI budget exceeded ($${currentSpending.toFixed(2)} of $${limit.toFixed(2)} used). Reset at midnight UTC or contact your administrator.`,
        };
      }

      return { allowed: true };
    } catch (error) {
      // Fail open: if the circuit breaker itself errors, allow the call
      this.logger.error(
        `Circuit breaker check failed for tenant ${tenantId}, failing open: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { allowed: true };
    }
  }

  /**
   * Record an AI call cost for a tenant. Adds to the daily accumulator in Redis.
   * The key has a 48-hour TTL so it auto-expires after the next day.
   */
  async recordCost(tenantId: string, cost: number): Promise<void> {
    try {
      const key = this.buildKey(tenantId);
      const current = await this.cache.get<number>(key) ?? 0;
      const updated = current + cost;

      await this.cache.set<number>(key, updated, CIRCUIT_TTL_SECONDS);

      this.logger.debug(
        `Recorded AI cost for tenant ${tenantId}: +$${cost.toFixed(4)}, total=$${updated.toFixed(4)}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to record AI cost for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Reset the circuit breaker for a tenant.
   * Deletes the Redis key so spending restarts from $0.
   * This is an admin action to manually unblock a tenant.
   */
  async resetCircuit(tenantId: string): Promise<void> {
    try {
      const key = this.buildKey(tenantId);
      await this.cache.del(key);
      this.logger.log(`Circuit breaker reset for tenant ${tenantId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to reset circuit for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
