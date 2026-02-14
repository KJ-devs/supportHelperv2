import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../../src/modules/analytics/analytics.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockAppId = 'app-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              count: jest.fn(),
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
            },
            application: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview statistics with default period (week)', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100) // total tickets
        .mockResolvedValueOnce(25) // new tickets
        .mockResolvedValueOnce(15); // resolved tickets

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([
        {
          createdAt: new Date('2026-01-01'),
          resolvedAt: new Date('2026-01-02'),
        },
      ]);

      (prisma.ticket.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'open', _count: 50 },
          { status: 'resolved', _count: 30 },
        ]) // by status
        .mockResolvedValueOnce([
          { severity: 'low', _count: 20 },
          { severity: 'high', _count: 15 },
        ]) // by severity
        .mockResolvedValueOnce([
          { type: 'bug', _count: 40 },
          { type: 'feature', _count: 10 },
        ]); // by type

      const result = await service.getOverview(mockTenantId);

      expect(result).toEqual(
        expect.objectContaining({
          totalTickets: 100,
          newTickets: 25,
          resolvedTickets: 15,
          avgResolutionTime: expect.any(Number),
          ticketsByStatus: expect.any(Array),
          ticketsBySeverity: expect.any(Array),
          ticketsByType: expect.any(Array),
          period: 'week',
        }),
      );
    });

    it('should support day period filter', async () => {
      (prisma.ticket.count as jest.Mock).mockResolvedValue(10);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getOverview(mockTenantId, 'day');

      expect(result.period).toBe('day');
      expect(prisma.ticket.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('should support month period filter', async () => {
      (prisma.ticket.count as jest.Mock).mockResolvedValue(50);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getOverview(mockTenantId, 'month');

      expect(result.period).toBe('month');
    });

    it('should calculate zero avgResolutionTime when no resolved tickets', async () => {
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getOverview(mockTenantId);

      expect(result.avgResolutionTime).toBe(0);
    });
  });

  describe('getTrends', () => {
    it('should return trend data grouped by date', async () => {
      const mockTickets = [
        { createdAt: new Date('2026-02-01T10:00:00Z'), status: 'open' },
        { createdAt: new Date('2026-02-01T14:00:00Z'), status: 'resolved' },
        { createdAt: new Date('2026-02-02T09:00:00Z'), status: 'open' },
      ];

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue(mockTickets);

      const result = await service.getTrends(mockTenantId, 'day', 30);

      expect(result).toEqual({
        period: 'day',
        days: 30,
        data: expect.any(Array),
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          createdAt: { gte: expect.any(Date) },
        },
        select: {
          createdAt: true,
          status: true,
        },
      });
    });

    it('should support week period grouping', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrends(mockTenantId, 'week', 60);

      expect(result.period).toBe('week');
      expect(result.days).toBe(60);
    });

    it('should support month period grouping', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrends(mockTenantId, 'month', 90);

      expect(result.period).toBe('month');
      expect(result.days).toBe(90);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80); // resolved

      const result = await service.getPerformanceMetrics(mockTenantId);

      expect(result).toEqual({
        firstResponseTime: expect.any(Number),
        resolutionRate: expect.any(Number),
        reopenRate: expect.any(Number),
        customerSatisfaction: expect.any(Number),
      });
    });

    it('should calculate correct resolution rate', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(75); // resolved

      const result = await service.getPerformanceMetrics(mockTenantId);

      expect(result.resolutionRate).toBe(75);
    });

    it('should return 0 resolution rate when no tickets exist', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0); // resolved

      const result = await service.getPerformanceMetrics(mockTenantId);

      expect(result.resolutionRate).toBe(0);
    });
  });

  describe('getAgentStats', () => {
    it('should return statistics for all agents', async () => {
      const mockAgents = [
        { id: 'agent-1', name: 'Agent One', email: 'agent1@test.com' },
        { id: 'agent-2', name: 'Agent Two', email: 'agent2@test.com' },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockAgents);
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(10) // assigned to agent-1
        .mockResolvedValueOnce(8) // resolved by agent-1
        .mockResolvedValueOnce(15) // assigned to agent-2
        .mockResolvedValueOnce(12); // resolved by agent-2

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([
        {
          createdAt: new Date('2026-01-01'),
          resolvedAt: new Date('2026-01-02'),
        },
      ]);

      const result = await service.getAgentStats(mockTenantId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        agent: {
          id: 'agent-1',
          name: 'Agent One',
          email: 'agent1@test.com',
        },
        ticketsAssigned: 10,
        ticketsResolved: 8,
        avgResolutionTime: expect.any(Number),
        resolutionRate: 80,
      });
    });

    it('should handle agents with no assigned tickets', async () => {
      const mockAgents = [{ id: 'agent-1', name: 'Agent One', email: 'agent1@test.com' }];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockAgents);
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(0) // assigned
        .mockResolvedValueOnce(0); // resolved
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAgentStats(mockTenantId);

      expect(result[0].resolutionRate).toBe(0);
      expect(result[0].avgResolutionTime).toBe(0);
    });

    it('should filter users by admin and agent roles', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await service.getAgentStats(mockTenantId);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          role: { in: ['admin', 'agent'] },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    });
  });

  describe('getApplicationStats', () => {
    it('should return statistics for all applications', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          name: 'App One',
          platform: 'web',
          _count: { tickets: 25 },
        },
        {
          id: 'app-2',
          name: 'App Two',
          platform: 'mobile',
          _count: { tickets: 15 },
        },
      ];

      (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(20) // resolved for app-1
        .mockResolvedValueOnce(5) // critical for app-1
        .mockResolvedValueOnce(10) // resolved for app-2
        .mockResolvedValueOnce(2); // critical for app-2

      const result = await service.getApplicationStats(mockTenantId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        application: {
          id: 'app-1',
          name: 'App One',
          platform: 'web',
        },
        totalTickets: 25,
        resolvedTickets: 20,
        criticalTickets: 5,
      });
    });

    it('should handle applications with no tickets', async () => {
      const mockApplications = [
        {
          id: 'app-1',
          name: 'App One',
          platform: 'web',
          _count: { tickets: 0 },
        },
      ];

      (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(0) // resolved
        .mockResolvedValueOnce(0); // critical

      const result = await service.getApplicationStats(mockTenantId);

      expect(result[0].totalTickets).toBe(0);
      expect(result[0].resolvedTickets).toBe(0);
      expect(result[0].criticalTickets).toBe(0);
    });
  });
});
