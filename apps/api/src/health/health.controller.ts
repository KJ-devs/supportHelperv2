import { Controller, Get, HttpCode, HttpStatus, Logger, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService, HealthStatus, CronJobStatus, QueueStatus } from '../monitoring/health.service';
import { CacheService, CacheTTL, CacheKeys } from '../cache';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly healthService: HealthService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Comprehensive health check of all dependencies' })
  @ApiResponse({
    status: 200,
    description: 'All services healthy or degraded',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2024-01-16T12:00:00Z',
        uptime: 12345,
        version: '0.1.0',
        services: {
          postgres: { status: 'healthy', responseTime: 5, lastCheck: '2024-01-16T12:00:00Z' },
          redis: { status: 'healthy', responseTime: 2, lastCheck: '2024-01-16T12:00:00Z' },
          minio: { status: 'healthy', responseTime: 10, lastCheck: '2024-01-16T12:00:00Z' },
          memory: { status: 'healthy', message: 'Heap: 45% used (90MB / 200MB)', lastCheck: '2024-01-16T12:00:00Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async health(@Res() res: Response): Promise<void> {
    let health: HealthStatus;
    try {
      health = await this.cacheService.getOrSet<HealthStatus>(
        CacheKeys.healthComprehensive(),
        CacheTTL.HEALTH_COMPREHENSIVE,
        () => this.healthService.getComprehensiveHealth(),
      );
    } catch (error) {
      this.logger.warn('Cache unavailable for health check, running directly', error);
      health = await this.healthService.getComprehensiveHealth();
    }
    const statusCode = health.status === 'unhealthy'
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.OK;
    res.status(statusCode).json(health);
  }

  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe - checks if app process is running' })
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
  @ApiOperation({ summary: 'Readiness probe - checks if all dependencies are available' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async ready(@Res() res: Response): Promise<void> {
    let isReady: boolean;
    try {
      isReady = await this.cacheService.getOrSet<boolean>(
        CacheKeys.healthReady(),
        CacheTTL.HEALTH_READY,
        () => this.healthService.isReady(),
      );
    } catch (error) {
      this.logger.warn('Cache unavailable for readiness check, running directly', error);
      isReady = await this.healthService.isReady();
    }
    if (isReady) {
      res.status(HttpStatus.OK).json({ status: 'ok' });
    } else {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({ status: 'not ready' });
    }
  }

  @Get('full')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full health check with all dependencies (auth required)' })
  @ApiResponse({ status: 200, description: 'Full health status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async fullHealth(): Promise<HealthStatus> {
    return this.healthService.getFullHealth();
  }

  @Get('db')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Database health check (auth required)' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  async databaseHealth() {
    const check = await this.healthService.checkDatabase();
    if (check.status === 'unhealthy') {
      throw new ServiceUnavailableException(check.message || 'Database unhealthy');
    }
    return check;
  }

  @Get('redis')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redis health check (auth required)' })
  @ApiResponse({ status: 200, description: 'Redis is healthy' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  async redisHealth() {
    const check = await this.healthService.checkRedis();
    if (check.status === 'unhealthy') {
      throw new ServiceUnavailableException(check.message || 'Redis unhealthy');
    }
    return check;
  }

  @Get('cron')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cron jobs status (auth required)' })
  @ApiResponse({ status: 200, description: 'Cron jobs status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  cronStatus(): CronJobStatus[] {
    return this.healthService.getCronJobsStatus();
  }

  @Get('queues')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Queue status (auth required)' })
  @ApiResponse({ status: 200, description: 'Queue status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Basic metrics (auth required)' })
  @ApiResponse({ status: 200, description: 'Basic process metrics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @Get('cache')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cache hit/miss metrics (auth required)' })
  @ApiResponse({ status: 200, description: 'Cache metrics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  cacheMetrics() {
    return this.cacheService.getMetrics();
  }
}
