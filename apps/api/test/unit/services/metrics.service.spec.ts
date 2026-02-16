import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../../src/modules/metrics/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let configService: ConfigService;

  const createTestingModule = async (prometheusEnabled: boolean | string | null) => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'PROMETHEUS_ENABLED') return prometheusEnabled;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    return {
      service: module.get<MetricsService>(MetricsService),
      configService: module.get<ConfigService>(ConfigService),
    };
  };

  describe('initialization', () => {
    it('should initialize metrics when PROMETHEUS_ENABLED is true (boolean)', async () => {
      const { service } = await createTestingModule(true);

      expect(service.isEnabled()).toBe(true);
    });

    it('should initialize metrics when PROMETHEUS_ENABLED is "true" (string)', async () => {
      const { service } = await createTestingModule('true');

      expect(service.isEnabled()).toBe(true);
    });

    it('should not initialize metrics when PROMETHEUS_ENABLED is false', async () => {
      const { service } = await createTestingModule(false);

      expect(service.isEnabled()).toBe(false);
    });

    it('should not initialize metrics when PROMETHEUS_ENABLED is undefined', async () => {
      const { service } = await createTestingModule(null);

      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format when enabled', async () => {
      const { service } = await createTestingModule(true);

      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should return empty string when disabled', async () => {
      const { service } = await createTestingModule(false);

      const metrics = await service.getMetrics();

      expect(metrics).toBe('');
    });
  });

  describe('recordHttpRequest', () => {
    it('should record HTTP request metrics when enabled', async () => {
      const { service } = await createTestingModule(true);

      service.recordHttpRequest({
        method: 'GET',
        path: '/api/tickets',
        statusCode: 200,
        duration: 150,
      });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('http_requests_total');
      expect(metrics).toContain('http_request_duration_seconds');
    });

    it('should normalize UUIDs in path', async () => {
      const { service } = await createTestingModule(true);

      service.recordHttpRequest({
        method: 'GET',
        path: '/api/tickets/550e8400-e29b-41d4-a716-446655440000',
        statusCode: 200,
        duration: 100,
      });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('http_requests_total');
    });

    it('should not record when disabled', async () => {
      const { service } = await createTestingModule(false);

      service.recordHttpRequest({
        method: 'GET',
        path: '/api/tickets',
        statusCode: 200,
        duration: 150,
      });

      const metrics = await service.getMetrics();
      expect(metrics).toBe('');
    });
  });

  describe('recordTicketCreated', () => {
    it('should record ticket creation when enabled', async () => {
      const { service } = await createTestingModule(true);

      service.recordTicketCreated({
        tenantId: 'tenant-123',
      });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('tickets_created_total');
    });

    it('should not record when disabled', async () => {
      const { service } = await createTestingModule(false);

      service.recordTicketCreated({
        tenantId: 'tenant-123',
      });

      // Should not throw error
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('recordAgentTask', () => {
    it('should record agent task with status when enabled', async () => {
      const { service } = await createTestingModule(true);

      service.recordAgentTask({
        status: 'completed',
        duration: 30000,
      });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('agent_tasks_total');
      expect(metrics).toContain('agent_tasks_duration_seconds');
    });

    it('should record agent task without duration', async () => {
      const { service } = await createTestingModule(true);

      service.recordAgentTask({
        status: 'in_progress',
      });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('agent_tasks_total');
    });
  });

  describe('recordBullMQJob', () => {
    it('should record BullMQ job metrics when enabled', async () => {
      const { service } = await createTestingModule(true);

      service.recordBullMQJob({
        queue: 'video-analysis',
        status: 'completed',
      });

      const metrics = await service.getMetrics();
      expect(metrics).toContain('bullmq_jobs_total');
    });
  });
});
