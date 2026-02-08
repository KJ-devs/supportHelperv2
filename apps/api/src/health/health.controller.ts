import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService, HealthStatus, CronJobStatus, QueueStatus } from '../monitoring/health.service';
import { Public } from '../common/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Basic health check (liveness)' })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2024-01-16T12:00:00Z',
        uptime: 12345,
        version: '0.1.0',
      },
    },
  })
  async health(): Promise<HealthStatus> {
    return this.healthService.getBasicHealth();
  }

  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service is not alive' })
  live(): { status: string } {
    if (this.healthService.isAlive()) {
      return { status: 'ok' };
    }
    throw new ServiceUnavailableException('Service not alive');
  }

  @Get('ready')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async ready(): Promise<{ status: string }> {
    const isReady = await this.healthService.isReady();
    if (isReady) {
      return { status: 'ok' };
    }
    throw new ServiceUnavailableException('Service not ready');
  }

  @Get('full')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full health check with all dependencies' })
  @ApiResponse({
    status: 200,
    description: 'Full health status',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2024-01-16T12:00:00Z',
        uptime: 12345,
        version: '0.1.0',
        checks: {
          database: { status: 'healthy', responseTime: 5 },
          redis: { status: 'healthy', responseTime: 2 },
          memory: { status: 'healthy', message: 'Heap: 45% used' },
        },
      },
    },
  })
  async fullHealth(): Promise<HealthStatus> {
    return this.healthService.getFullHealth();
  }

  @Get('db')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  async databaseHealth() {
    const check = await this.healthService.checkDatabase();
    if (check.status === 'unhealthy') {
      throw new ServiceUnavailableException(check.message || 'Database unhealthy');
    }
    return check;
  }

  @Get('redis')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redis health check' })
  @ApiResponse({ status: 200, description: 'Redis is healthy' })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  async redisHealth() {
    const check = await this.healthService.checkRedis();
    if (check.status === 'unhealthy') {
      throw new ServiceUnavailableException(check.message || 'Redis unhealthy');
    }
    return check;
  }

  @Get('cron')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cron jobs status' })
  @ApiResponse({
    status: 200,
    description: 'Cron jobs status',
    schema: {
      example: [
        {
          name: 'cleanup-expired-media',
          lastRun: '2024-01-16T11:00:00Z',
          nextRun: '2024-01-16T12:00:00Z',
          status: 'completed',
        },
      ],
    },
  })
  cronStatus(): CronJobStatus[] {
    return this.healthService.getCronJobsStatus();
  }

  @Get('queues')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Queue status (BullMQ)' })
  @ApiResponse({
    status: 200,
    description: 'Queue status',
    schema: {
      example: {
        queues: [
          {
            name: 'video-processing',
            waiting: 5,
            active: 2,
            completed: 100,
            failed: 3,
            delayed: 0,
            paused: false,
          },
        ],
        deadLetterQueue: 3,
      },
    },
  })
  async queuesStatus(): Promise<{
    queues: (QueueStatus | null)[];
    deadLetterQueue: number;
  }> {
    const queueNames = ['video-processing', 'ai-analysis', 'email', 'webhooks'];
    const queues = await Promise.all(
      queueNames.map((name) => this.healthService.getQueueStatus(name)),
    );
    const deadLetterQueue = await this.healthService.getDeadLetterQueueCount();

    return {
      queues: queues.filter((q) => q !== null),
      deadLetterQueue,
    };
  }

  @Get('metrics')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Basic metrics' })
  @ApiResponse({
    status: 200,
    description: 'Basic process metrics',
  })
  metrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      pid: process.pid,
      nodeVersion: process.version,
    };
  }
}
