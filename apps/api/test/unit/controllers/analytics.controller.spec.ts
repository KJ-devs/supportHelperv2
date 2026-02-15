import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from '../../../src/modules/analytics/analytics.controller';
import { AnalyticsService } from '../../../src/modules/analytics/analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: jest.Mocked<AnalyticsService>;

  const mockOverview = {
    totalTickets: 100,
    openTickets: 25,
    resolvedTickets: 75,
    avgResolutionTime: 3600,
  };

  const mockTrends = {
    data: [
      { date: '2026-01-01', count: 10 },
      { date: '2026-01-02', count: 15 },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: {
            getOverview: jest.fn(),
            getTrends: jest.fn(),
            getPerformanceMetrics: jest.fn(),
            getAgentStats: jest.fn(),
            getApplicationStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview with default period', async () => {
      (analyticsService.getOverview as jest.Mock).mockResolvedValue(mockOverview);

      const result = await controller.getOverview('tenant-123', {} as any);

      expect(analyticsService.getOverview).toHaveBeenCalledWith('tenant-123', 'week');
      expect(result).toEqual(mockOverview);
    });

    it('should return overview with specified period', async () => {
      (analyticsService.getOverview as jest.Mock).mockResolvedValue(mockOverview);

      const result = await controller.getOverview('tenant-123', { period: 'month' } as any);

      expect(analyticsService.getOverview).toHaveBeenCalledWith('tenant-123', 'month');
    });
  });

  describe('getTrends', () => {
    it('should return trends with defaults', async () => {
      (analyticsService.getTrends as jest.Mock).mockResolvedValue(mockTrends);

      const result = await controller.getTrends('tenant-123', {} as any);

      expect(analyticsService.getTrends).toHaveBeenCalledWith('tenant-123', 'week', 30);
      expect(result).toEqual(mockTrends);
    });

    it('should pass custom period and days', async () => {
      (analyticsService.getTrends as jest.Mock).mockResolvedValue(mockTrends);

      await controller.getTrends('tenant-123', { period: 'day', days: 7 } as any);

      expect(analyticsService.getTrends).toHaveBeenCalledWith('tenant-123', 'day', 7);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const mockMetrics = { avgResponseTime: 500, p95: 1200 };
      (analyticsService.getPerformanceMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const result = await controller.getPerformanceMetrics('tenant-123');

      expect(analyticsService.getPerformanceMetrics).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual(mockMetrics);
    });
  });

  describe('getAgentStats', () => {
    it('should return agent statistics', async () => {
      const mockStats = { totalSessions: 50, avgMessages: 5 };
      (analyticsService.getAgentStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await controller.getAgentStats('tenant-123');

      expect(analyticsService.getAgentStats).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getApplicationStats', () => {
    it('should return application statistics', async () => {
      const mockStats = { apps: [{ id: 'app-1', ticketCount: 25 }] };
      (analyticsService.getApplicationStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await controller.getApplicationStats('tenant-123');

      expect(analyticsService.getApplicationStats).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual(mockStats);
    });
  });
});
