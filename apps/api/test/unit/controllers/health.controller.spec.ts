import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '../../../src/health/health.controller';
import { HealthService } from '../../../src/monitoring/health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
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
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return basic health status', async () => {
      const mockHealth = { status: 'healthy', timestamp: new Date().toISOString(), uptime: 100, version: '0.1.0' };
      (healthService.getBasicHealth as jest.Mock).mockResolvedValue(mockHealth);

      const result = await controller.health();

      expect(result).toEqual(mockHealth);
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
    it('should return ok when ready', async () => {
      (healthService.isReady as jest.Mock).mockResolvedValue(true);

      const result = await controller.ready();

      expect(result).toEqual({ status: 'ok' });
    });

    it('should throw ServiceUnavailableException when not ready', async () => {
      (healthService.isReady as jest.Mock).mockResolvedValue(false);

      await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
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
});
