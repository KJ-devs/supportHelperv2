import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import Redis from 'ioredis';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services?: Record<string, HealthCheck>;
  checks?: Record<string, HealthCheck>;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
  lastCheck?: string;
}

export interface CronJobStatus {
  name: string;
  lastRun: string | null;
  nextRun: string | null;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  lastError?: string;
}

export interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private redis: Redis | null = null;
  private redisInitialized = false;
  private s3Client: S3Client | null = null;
  private s3Initialized = false;
  private cronJobs: Map<string, CronJobStatus> = new Map();
  private readonly startTime = Date.now();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Don't initialize Redis/S3 in constructor to avoid blocking startup
  }

  private getRedis(): Redis | null {
    if (!this.redisInitialized) {
      this.redisInitialized = true;
      const redisUrl = this.config.get<string>('database.redisUrl');
      if (redisUrl) {
        try {
          this.redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            lazyConnect: true,
            retryStrategy: () => null, // Don't retry for health checks
          });
        } catch (error) {
          console.warn('[HealthService] Failed to create Redis client:', error);
          this.redis = null;
        }
      }
    }
    return this.redis;
  }

  private getS3Client(): S3Client | null {
    if (!this.s3Initialized) {
      this.s3Initialized = true;
      const endpoint = this.config.get<string>('s3.endpoint');
      const accessKeyId = this.config.get<string>('s3.accessKeyId');
      const secretAccessKey = this.config.get<string>('s3.secretAccessKey');
      const region = this.config.get<string>('s3.region') || 'us-east-1';

      if (endpoint && accessKeyId && secretAccessKey) {
        try {
          this.s3Client = new S3Client({
            endpoint,
            region,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
          });
        } catch (error) {
          this.logger.warn('Failed to create S3 client for health checks', error);
          this.s3Client = null;
        }
      }
    }
    return this.s3Client;
  }

  async getBasicHealth(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.config.get('app.version') || '0.1.0',
    };
  }

  /**
   * Comprehensive health check of all dependencies.
   * Returns status of each service with latency.
   */
  async getComprehensiveHealth(): Promise<HealthStatus> {
    const services: Record<string, HealthCheck> = {};

    const [dbCheck, redisCheck, s3Check] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkS3(),
    ]);

    services.postgres = dbCheck;
    services.redis = redisCheck;
    services.minio = s3Check;
    services.memory = this.checkMemory();

    // Determine overall status
    const statuses = Object.values(services).map((s) => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (statuses.includes('unhealthy')) {
      // Database unhealthy => fully unhealthy; others => degraded
      if (services.postgres.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.config.get('app.version') || '0.1.0',
      services,
    };
  }

  async getFullHealth(): Promise<HealthStatus> {
    const checks: Record<string, HealthCheck> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database check
    checks.database = await this.checkDatabase();
    if (checks.database.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    }

    // Redis check
    checks.redis = await this.checkRedis();
    if (checks.redis.status === 'unhealthy') {
      overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    // S3/MinIO check
    checks.minio = await this.checkS3();
    if (checks.minio.status === 'unhealthy') {
      overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    // Memory check
    checks.memory = this.checkMemory();
    if (checks.memory.status === 'unhealthy') {
      overallStatus = overallStatus === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.config.get('app.version') || '0.1.0',
      checks,
    };
  }

  async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Database connection failed',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  async checkRedis(): Promise<HealthCheck> {
    const redis = this.getRedis();
    if (!redis) {
      return {
        status: 'unhealthy',
        message: 'Redis not configured',
        lastCheck: new Date().toISOString(),
      };
    }

    const start = Date.now();
    try {
      await redis.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'Redis connection failed',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  async checkS3(): Promise<HealthCheck> {
    const s3 = this.getS3Client();
    if (!s3) {
      return {
        status: 'unhealthy',
        message: 'S3/MinIO not configured',
        lastCheck: new Date().toISOString(),
      };
    }

    const start = Date.now();
    try {
      await s3.send(new ListBucketsCommand({}));
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        message: error instanceof Error ? error.message : 'S3/MinIO connection failed',
        lastCheck: new Date().toISOString(),
      };
    }
  }

  checkMemory(): HealthCheck {
    const used = process.memoryUsage();
    const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;
    const threshold = 90; // 90% threshold

    return {
      status: heapUsedPercent < threshold ? 'healthy' : 'unhealthy',
      message: `Heap: ${Math.round(heapUsedPercent)}% used (${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB)`,
      lastCheck: new Date().toISOString(),
    };
  }

  // Cron job tracking
  registerCronJob(name: string, nextRun: Date): void {
    this.cronJobs.set(name, {
      name,
      lastRun: null,
      nextRun: nextRun.toISOString(),
      status: 'scheduled',
    });
  }

  updateCronJobStatus(
    name: string,
    status: 'running' | 'completed' | 'failed',
    error?: string,
  ): void {
    const job = this.cronJobs.get(name);
    if (job) {
      job.status = status;
      job.lastRun = new Date().toISOString();
      if (error) {
        job.lastError = error;
      }
    }
  }

  getCronJobsStatus(): CronJobStatus[] {
    return Array.from(this.cronJobs.values());
  }

  // Queue monitoring (BullMQ)
  async getQueueStatus(queueName: string): Promise<QueueStatus | null> {
    const redis = this.getRedis();
    if (!redis) return null;

    try {
      const prefix = `bull:${queueName}:`;
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        redis.llen(`${prefix}wait`),
        redis.llen(`${prefix}active`),
        redis.get(`${prefix}completed`).then((v) => parseInt(v || '0', 10)),
        redis.zcard(`${prefix}failed`),
        redis.zcard(`${prefix}delayed`),
        redis.get(`${prefix}paused`).then((v) => v === '1'),
      ]);

      return {
        name: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      };
    } catch {
      return null;
    }
  }

  async getDeadLetterQueueCount(): Promise<number> {
    const redis = this.getRedis();
    if (!redis) return 0;

    try {
      // Check all known queues for failed jobs
      const queues = ['video-processing', 'ai-analysis', 'email', 'webhooks'];
      let total = 0;

      for (const queue of queues) {
        const count = await redis.zcard(`bull:${queue}:failed`);
        total += count;
      }

      return total;
    } catch {
      return 0;
    }
  }

  // Liveness check (is the process alive?)
  isAlive(): boolean {
    return true;
  }

  // Readiness check (is the service ready to accept traffic?)
  async isReady(): Promise<boolean> {
    const [dbCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    return dbCheck.status === 'healthy' && redisCheck.status === 'healthy';
  }
}
