import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { HealthController } from '../health.controller';
import { PrismaService } from '../../services/prisma.service';
import { MeilisearchService } from '../../services/meilisearch.service';
import { QUEUE_NAMES } from '../../queues';
import { Response } from 'express';

/**
 * Unit tests for HealthController
 *
 * Covers:
 * - GET /health        — full status (DB + Redis + Meilisearch + queue stats)
 * - GET /health/live   — liveness probe (always 200)
 * - GET /health/ready  — readiness probe (HTTP 200 only when all deps healthy)
 *
 * Key scenario: worker must be reported unhealthy when Redis is down
 */
describe('HealthController', () => {
  let controller: HealthController;

  // Mock Express Response object used by getReadiness
  let mockRes: { status: jest.Mock };

  // Mocks
  let mockVideoQueue: jest.Mocked<{
    client: Promise<{ ping: jest.Mock }>;
    getWaitingCount: jest.Mock;
    getActiveCount: jest.Mock;
    getCompletedCount: jest.Mock;
    getFailedCount: jest.Mock;
  }>;
  let mockGithubQueue: typeof mockVideoQueue;
  let mockAgentQueue: typeof mockVideoQueue;
  let mockPrisma: { $queryRaw: jest.Mock };
  let mockMeilisearch: { isHealthy: jest.Mock };

  // Default Redis client mock (ping succeeds)
  let mockRedisClient: { ping: jest.Mock };

  const buildQueueMock = (redisClient: { ping: jest.Mock }) => ({
    client: Promise.resolve(redisClient),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(10),
    getFailedCount: jest.fn().mockResolvedValue(0),
  });

  beforeEach(async () => {
    mockRedisClient = { ping: jest.fn().mockResolvedValue('PONG') };

    // Express Response mock: status() is a no-op (passthrough mode)
    mockRes = { status: jest.fn().mockReturnThis() };

    mockVideoQueue = buildQueueMock(mockRedisClient);
    mockGithubQueue = buildQueueMock(mockRedisClient);
    mockAgentQueue = buildQueueMock(mockRedisClient);

    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    mockMeilisearch = {
      isHealthy: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: getQueueToken(QUEUE_NAMES.VIDEO_ANALYSIS), useValue: mockVideoQueue },
        { provide: getQueueToken(QUEUE_NAMES.GITHUB_SYNC), useValue: mockGithubQueue },
        { provide: getQueueToken(QUEUE_NAMES.AGENT_ORCHESTRATION), useValue: mockAgentQueue },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MeilisearchService, useValue: mockMeilisearch },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  // -----------------------------------------------------------------------
  // Basic wiring
  // -----------------------------------------------------------------------

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // GET /health/live — liveness probe (process is up, no dependency check)
  // -----------------------------------------------------------------------

  describe('getLiveness (GET /health/live)', () => {
    it('returns { status: "ok" } regardless of dependency state', () => {
      const result = controller.getLiveness();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  // -----------------------------------------------------------------------
  // GET /health/ready — readiness probe
  // -----------------------------------------------------------------------

  describe('getReadiness (GET /health/ready)', () => {
    it('returns ready=true and HTTP 200 when all dependencies are healthy', async () => {
      const result = await controller.getReadiness(mockRes as unknown as Response);

      expect(result.ready).toBe(true);
      expect(result.status).toBe('ok');
      // res.status() must NOT be called when healthy (NestJS defaults to 200)
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('returns ready=false and HTTP 503 when Redis is down', async () => {
      // Simulate Redis being unreachable: ping() throws
      mockRedisClient.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.getReadiness(mockRes as unknown as Response);

      expect(result.ready).toBe(false);
      expect(result.status).toBe('not ready');
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it('returns ready=false and HTTP 503 when the database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await controller.getReadiness(mockRes as unknown as Response);

      expect(result.ready).toBe(false);
      expect(result.status).toBe('not ready');
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    it('returns ready=false and HTTP 503 when both Redis and DB are down', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis unavailable'));
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB unavailable'));

      const result = await controller.getReadiness(mockRes as unknown as Response);

      expect(result.ready).toBe(false);
      expect(result.status).toBe('not ready');
      expect(mockRes.status).toHaveBeenCalledWith(503);
    });
  });

  // -----------------------------------------------------------------------
  // GET /health — full health status
  // -----------------------------------------------------------------------

  describe('getHealth (GET /health)', () => {
    it('returns status="healthy" when all dependencies respond', async () => {
      const result = await controller.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.services.database).toBe(true);
      expect(result.services.redis).toBe(true);
      expect(result.services.meilisearch).toBe(true);
    });

    it('includes timestamp and uptime fields', async () => {
      const result = await controller.getHealth();

      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes queue stats for all three queues', async () => {
      const result = await controller.getHealth();

      expect(result.queues).toBeDefined();
      expect(result.queues[QUEUE_NAMES.VIDEO_ANALYSIS]).toBeDefined();
      expect(result.queues[QUEUE_NAMES.GITHUB_SYNC]).toBeDefined();
      expect(result.queues[QUEUE_NAMES.AGENT_ORCHESTRATION]).toBeDefined();
    });

    it('returns status="unhealthy" when Redis is down', async () => {
      // All three queues share the same mockRedisClient, so failing ping
      // makes checkRedis() return false — all three other services also need to fail
      // for "unhealthy"; if only Redis fails it becomes "degraded".
      // Test the degraded→unhealthy pathway by also failing DB and Meili.
      mockRedisClient.ping.mockRejectedValue(new Error('Redis down'));
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockMeilisearch.isHealthy.mockResolvedValue(false);

      const result = await controller.getHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.services.redis).toBe(false);
      expect(result.services.database).toBe(false);
      expect(result.services.meilisearch).toBe(false);
    });

    it('returns status="degraded" when only Redis is down', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis down'));

      const result = await controller.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.redis).toBe(false);
      expect(result.services.database).toBe(true);
      expect(result.services.meilisearch).toBe(true);
    });

    it('returns queue stats with -1 values when a queue errors', async () => {
      // Make one queue's getWaitingCount throw
      mockVideoQueue.getWaitingCount.mockRejectedValue(new Error('Queue error'));
      mockVideoQueue.getActiveCount.mockRejectedValue(new Error('Queue error'));
      mockVideoQueue.getCompletedCount.mockRejectedValue(new Error('Queue error'));
      mockVideoQueue.getFailedCount.mockRejectedValue(new Error('Queue error'));

      const result = await controller.getHealth();

      expect(result.queues[QUEUE_NAMES.VIDEO_ANALYSIS]).toEqual({
        waiting: -1,
        active: -1,
        completed: -1,
        failed: -1,
      });
    });
  });
});
