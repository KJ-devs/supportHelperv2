import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let _prisma: PrismaService;

  const mockTenantId = 'tenant-123';

  const mockAgents = [
    { id: 'agent-1', name: 'John Doe', email: 'john@example.com' },
    { id: 'agent-2', name: 'Jane Smith', email: 'jane@example.com' },
  ];

  const mockPrismaService = {
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    _prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();

    // Default mock for findMany to return empty array
    mockPrismaService.ticket.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    beforeEach(() => {
      mockPrismaService.ticket.count
        .mockResolvedValueOnce(100) // totalTickets
        .mockResolvedValueOnce(25) // newTickets
        .mockResolvedValueOnce(15); // resolvedTickets

      mockPrismaService.ticket.findMany.mockResolvedValue([]);

      mockPrismaService.ticket.groupBy
        .mockResolvedValueOnce([
          { status: 'new', _count: 30 },
          { status: 'open', _count: 40 },
          { status: 'resolved', _count: 30 },
        ])
        .mockResolvedValueOnce([
          { severity: 'high', _count: 20 },
          { severity: 'medium', _count: 50 },
          { severity: 'low', _count: 30 },
        ])
        .mockResolvedValueOnce([
          { type: 'bug', _count: 45 },
          { type: 'feature', _count: 30 },
          { type: 'question', _count: 25 },
        ]);
    });

    it('should return overview statistics for week period', async () => {
      const result = await service.getOverview(mockTenantId, 'week');

      expect(result).toHaveProperty('totalTickets');
      expect(result).toHaveProperty('newTickets');
      expect(result).toHaveProperty('resolvedTickets');
      expect(result).toHaveProperty('ticketsByStatus');
      expect(result).toHaveProperty('ticketsBySeverity');
      expect(result).toHaveProperty('ticketsByType');
      expect(result.period).toBe('week');
    });

    it('should return overview statistics for day period', async () => {
      mockPrismaService.ticket.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(15);
      mockPrismaService.ticket.groupBy
        .mockResolvedValueOnce([{ status: 'new', _count: 30 }])
        .mockResolvedValueOnce([{ severity: 'high', _count: 20 }])
        .mockResolvedValueOnce([{ type: 'bug', _count: 45 }]);

      const result = await service.getOverview(mockTenantId, 'day');

      expect(result.period).toBe('day');
    });

    it('should return overview statistics for month period', async () => {
      mockPrismaService.ticket.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(15);
      mockPrismaService.ticket.groupBy
        .mockResolvedValueOnce([{ status: 'new', _count: 30 }])
        .mockResolvedValueOnce([{ severity: 'high', _count: 20 }])
        .mockResolvedValueOnce([{ type: 'bug', _count: 45 }]);

      const result = await service.getOverview(mockTenantId, 'month');

      expect(result.period).toBe('month');
    });
  });

  describe('getTrends', () => {
    beforeEach(() => {
      mockPrismaService.ticket.groupBy.mockResolvedValue([
        { createdAt: new Date('2024-01-10'), status: 'new', _count: 5 },
        { createdAt: new Date('2024-01-10'), status: 'resolved', _count: 3 },
        { createdAt: new Date('2024-01-11'), status: 'new', _count: 8 },
        { createdAt: new Date('2024-01-11'), status: 'resolved', _count: 4 },
      ]);
    });

    it('should return ticket trends data', async () => {
      const result = await service.getTrends(mockTenantId, 'week', 30);

      expect(result).toHaveProperty('period', 'week');
      expect(result).toHaveProperty('days', 30);
      expect(result).toHaveProperty('data');
      expect(mockPrismaService.ticket.groupBy).toHaveBeenCalled();
    });
  });

  describe('getAgentStats', () => {
    beforeEach(() => {
      mockPrismaService.user.findMany.mockResolvedValue(mockAgents);
      mockPrismaService.ticket.count.mockResolvedValue(10);
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
    });

    it('should return agent statistics', async () => {
      const result = await service.getAgentStats(mockTenantId);

      expect(result).toBeInstanceOf(Array);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
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

    it('should return empty array when no agents found', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.getAgentStats(mockTenantId);

      expect(result).toEqual([]);
    });
  });
});
