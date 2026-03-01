import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

export interface AiUsageDayStats {
  date: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface AiUsageResponse {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  costPerTicket: number;
  byDay: AiUsageDayStats[];
  period: number;
}

@Injectable()
export class AiUsageService implements OnModuleDestroy {
  private readonly logger = new Logger(AiUsageService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getRedis(): Redis {
    if (!this.redis) {
      const redisUrl =
        this.config.get<string>('database.redisUrl') || 'redis://localhost:6379';
      const url = new URL(redisUrl);
      this.redis = new Redis({
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        maxRetriesPerRequest: null,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      this.redis.on('error', (err) => {
        this.logger.warn(`AiUsageService Redis error: ${err.message}`);
      });
    }

    return this.redis;
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  /**
   * Read 30 days of AI cost data from Redis for a tenant.
   * Keys written by the Worker:
   *   ai:cost:{tenantId}:{date}:total   — float (cost in $)
   *   ai:cost:{tenantId}:{date}:tokens  — hash { input, output }
   *   ai:cost:{tenantId}:{date}:requests — hash { model: count }
   */
  async getUsage(tenantId: string, days = 30): Promise<AiUsageResponse> {
    const redis = this.getRedis();

    let totalCost = 0;
    let totalTokens = 0;
    let totalRequests = 0;
    const byDay: AiUsageDayStats[] = [];

    try {
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        if (!dateStr) continue;

        const key = `ai:cost:${tenantId}:${dateStr}`;

        const [costRaw, tokensHash, requestsHash] = await Promise.all([
          redis.get(`${key}:total`),
          redis.hgetall(`${key}:tokens`),
          redis.hgetall(`${key}:requests`),
        ]);

        const dayCost = parseFloat(costRaw || '0');
        const dayInputTokens = parseInt(tokensHash?.input || '0', 10);
        const dayOutputTokens = parseInt(tokensHash?.output || '0', 10);
        const dayTokens = dayInputTokens + dayOutputTokens;

        let dayRequests = 0;
        if (requestsHash) {
          for (const count of Object.values(requestsHash)) {
            dayRequests += parseInt(count, 10);
          }
        }

        totalCost += dayCost;
        totalTokens += dayTokens;
        totalRequests += dayRequests;

        byDay.push({
          date: dateStr,
          cost: dayCost,
          tokens: dayTokens,
          requests: dayRequests,
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to read AI usage from Redis: ${err}`);
    }

    // Sort ascending by date
    byDay.sort((a, b) => a.date.localeCompare(b.date));

    // Count analyzed tickets in the period
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    let analyzedTickets = 0;
    try {
      analyzedTickets = await this.prisma.ticket.count({
        where: {
          tenantId,
          aiSummary: { not: null },
          updatedAt: { gte: periodStart },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to count analyzed tickets: ${err}`);
    }

    const costPerTicket =
      analyzedTickets > 0 ? totalCost / analyzedTickets : 0;

    return {
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      totalTokens,
      totalRequests,
      costPerTicket: Math.round(costPerTicket * 1000000) / 1000000,
      byDay,
      period: days,
    };
  }
}
