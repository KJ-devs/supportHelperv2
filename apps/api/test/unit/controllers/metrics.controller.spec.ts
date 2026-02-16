import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from '../../../src/modules/metrics/metrics.controller';
import { MetricsService } from '../../../src/modules/metrics/metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let service: MetricsService;

  const mockMetricsService = {
    isEnabled: jest.fn(),
    getMetrics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should return Prometheus metrics when enabled', async () => {
      const metricsOutput = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/tickets",status="200"} 100
`;

      mockMetricsService.isEnabled.mockReturnValue(true);
      mockMetricsService.getMetrics.mockResolvedValue(metricsOutput);

      const result = await controller.getMetrics();

      expect(result).toBe(metricsOutput);
      expect(service.isEnabled).toHaveBeenCalled();
      expect(service.getMetrics).toHaveBeenCalled();
    });

    it('should return disabled message when metrics disabled', async () => {
      mockMetricsService.isEnabled.mockReturnValue(false);

      const result = await controller.getMetrics();

      expect(result).toBe('# Prometheus metrics disabled\n');
      expect(service.isEnabled).toHaveBeenCalled();
      expect(service.getMetrics).not.toHaveBeenCalled();
    });
  });
});
