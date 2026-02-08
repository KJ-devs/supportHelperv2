import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import { PrismaService } from '../services/prisma.service';
import { MeilisearchService } from '../services/meilisearch.service';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: boolean;
    redis: boolean;
    meilisearch: boolean;
  };
  queues: {
    [key: string]: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  };
}

/**
 * Health Controller
 *
 * Provides health check endpoints for the worker service
 */
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    @InjectQueue(QUEUE_NAMES.VIDEO_ANALYSIS)
    private readonly videoQueue: Queue,
    @InjectQueue(QUEUE_NAMES.GITHUB_SYNC)
    private readonly githubQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_ORCHESTRATION)
    private readonly agentQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly meilisearch: MeilisearchService
  ) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    const [database, redis, meilisearch] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMeilisearch(),
    ]);

    const queues = await this.getQueueStats();

    const allHealthy = database && redis && meilisearch;
    const anyHealthy = database || redis || meilisearch;

    return {
      status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      services: {
        database,
        redis,
        meilisearch,
      },
      queues,
    };
  }

  @Get('live')
  getLiveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<{ status: string; ready: boolean }> {
    const health = await this.getHealth();
    return {
      status: health.status === 'healthy' ? 'ok' : 'not ready',
      ready: health.status === 'healthy',
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const client = await this.videoQueue.client;
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkMeilisearch(): Promise<boolean> {
    try {
      return await this.meilisearch.isHealthy();
    } catch {
      return false;
    }
  }

  private async getQueueStats(): Promise<HealthStatus['queues']> {
    const queues = {
      [QUEUE_NAMES.VIDEO_ANALYSIS]: this.videoQueue,
      [QUEUE_NAMES.GITHUB_SYNC]: this.githubQueue,
      [QUEUE_NAMES.AGENT_ORCHESTRATION]: this.agentQueue,
    };

    const stats: HealthStatus['queues'] = {};

    for (const [name, queue] of Object.entries(queues)) {
      try {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);

        stats[name] = { waiting, active, completed, failed };
      } catch {
        stats[name] = { waiting: -1, active: -1, completed: -1, failed: -1 };
      }
    }

    return stats;
  }
}
