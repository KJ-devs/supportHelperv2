import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../../src/health/health.controller';
import { HealthService } from '../../../src/monitoring/health.service';
import { CacheService } from '../../../src/cache/cache.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  const mockResponse = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getComprehensiveHealth: jest.fn(),
            getBasicHealth: jest.fn(),
            isAlive: jest.fn(),
            isReady: jest.fn(),
            getFullHealth: jest.fn(),
            checkDatabase: jest.fn(),
            checkRedis: jest.fn(),
            getCronJobsStatus: jest.fn(),
            getQueueStatus: jest.fn(),
            getDeadLetterQueueCount: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getMetrics: jest.fn().mockReturnValue({ hits: 0, misses: 0, hitRate: '0%', total: 0 }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return 200 with comprehensive health when all healthy', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        version: '0.1.0',
        services: {
          postgres: { status: 'healthy', responseTime: 5 },
          redis: { status: 'healthy', responseTime: 2 },
          minio: { status: 'healthy', responseTime: 10 },
          memory: { status: 'healthy', message: 'Heap: 45%' },
        },
      };
      (healthService.getComprehensiveHealth as jest.Mock).mockResolvedValue(mockHealth);
      const res = mockResponse();

      await controller.health(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockHealth);
    });

    it('should return 503 when service is unhealthy', async () => {
      const mockHealth = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: 100,
        version: '0.1.0',
        services: {
          postgres: { status: 'unhealthy', message: 'Connection refused' },
        },
      };
      (healthService.getComprehensiveHealth as jest.Mock).mockResolvedValue(mockHealth);
      const res = mockResponse();

      await controller.health(res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(mockHealth);
    });

    it('should return 200 when degraded', async () => {
      const mockHealth = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        uptime: 100,
        version: '0.1.0',
        services: {
          postgres: { status: 'healthy' },
          minio: { status: 'unhealthy' },
        },
      };
      (healthService.getComprehensiveHealth as jest.Mock).mockResolvedValue(mockHealth);
      const res = mockResponse();

      await controller.health(res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('live', () => {
    it('should return ok when alive', () => {
      (healthService.isAlive as jest.Mock).mockReturnValue(true);

      const result = controller.live();

      expect(result).toEqual({ status: 'ok' });
    });

    it('should throw ServiceUnavailableException when not alive', () => {
      (healthService.isAlive as jest.Mock).mockReturnValue(false);

      expect(() => controller.live()).toThrow(ServiceUnavailableException);
    });
  });

  describe('ready', () => {
    it('should return 200 when ready', async () => {
      (healthService.isReady as jest.Mock).mockResolvedValue(true);
      const res = mockResponse();

      await controller.ready(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('should return 503 when not ready', async () => {
      (healthService.isReady as jest.Mock).mockResolvedValue(false);
      const res = mockResponse();

      await controller.ready(res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ status: 'not ready' });
    });
  });

  describe('fullHealth', () => {
    it('should return full health status', async () => {
      const mockFull = { status: 'healthy', database: 'up', redis: 'up' };
      (healthService.getFullHealth as jest.Mock).mockResolvedValue(mockFull);

      const result = await controller.fullHealth();

      expect(result).toEqual(mockFull);
    });
  });

  describe('databaseHealth', () => {
    it('should return healthy when DB is up', async () => {
      const check = { status: 'healthy', responseTime: 5 };
      (healthService.checkDatabase as jest.Mock).mockResolvedValue(check);

      const result = await controller.databaseHealth();

      expect(result).toEqual(check);
    });

    it('should throw ServiceUnavailableException when DB is down', async () => {
      (healthService.checkDatabase as jest.Mock).mockResolvedValue({ status: 'unhealthy', message: 'Connection refused' });

      await expect(controller.databaseHealth()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('redisHealth', () => {
    it('should return healthy when Redis is up', async () => {
      const check = { status: 'healthy', responseTime: 2 };
      (healthService.checkRedis as jest.Mock).mockResolvedValue(check);

      const result = await controller.redisHealth();

      expect(result).toEqual(check);
    });

    it('should throw ServiceUnavailableException when Redis is down', async () => {
      (healthService.checkRedis as jest.Mock).mockResolvedValue({ status: 'unhealthy', message: 'Timeout' });

      await expect(controller.redisHealth()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('cronStatus', () => {
    it('should return cron jobs status', () => {
      const mockCrons = [{ name: 'cleanup', lastRun: new Date(), status: 'ok' }];
      (healthService.getCronJobsStatus as jest.Mock).mockReturnValue(mockCrons);

      const result = controller.cronStatus();

      expect(result).toEqual(mockCrons);
    });
  });

  describe('queuesStatus', () => {
    it('should return queue statuses', async () => {
      (healthService.getQueueStatus as jest.Mock).mockResolvedValue({ name: 'test', waiting: 0, active: 0 });
      (healthService.getDeadLetterQueueCount as jest.Mock).mockResolvedValue(0);

      const result = await controller.queuesStatus();

      expect(result.queues).toHaveLength(4);
      expect(result.deadLetterQueue).toBe(0);
    });
  });

  describe('metrics', () => {
    it('should return process metrics', () => {
      const result = controller.metrics();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('cpu');
      expect(result).toHaveProperty('pid');
      expect(result).toHaveProperty('nodeVersion');
    });
  });

  describe('cacheMetrics', () => {
    it('should return cache metrics', () => {
      const result = controller.cacheMetrics();

      expect(result).toEqual({ hits: 0, misses: 0, hitRate: '0%', total: 0 });
    });
  });
});
