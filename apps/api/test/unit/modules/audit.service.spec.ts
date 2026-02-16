import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../../../src/modules/audit/audit.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'audit-1',
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'create_user',
        resourceType: 'users',
        resourceId: 'user-2',
        details: { method: 'POST' },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      });

      await service.log({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorType: 'user',
        action: 'create_user',
        resourceType: 'users',
        resourceId: 'user-2',
        details: { method: 'POST' },
        ipAddress: '127.0.0.1',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          actorId: 'user-1',
          actorType: 'user',
          action: 'create_user',
          resourceType: 'users',
          resourceId: 'user-2',
          details: { method: 'POST' },
          ipAddress: '127.0.0.1',
        },
      });
    });

    it('should handle missing optional fields', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.log({
        tenantId: 'tenant-1',
        actorType: 'system',
        action: 'system_startup',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          actorId: null,
          actorType: 'system',
          action: 'system_startup',
          resourceType: null,
          resourceId: null,
          details: {},
          ipAddress: null,
        },
      });
    });

    it('should not throw error if create fails (non-blocking)', async () => {
      mockPrismaService.auditLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(
        service.log({
          tenantId: 'tenant-1',
          actorType: 'user',
          action: 'test_action',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          actorId: 'user-1',
          actorType: 'user',
          action: 'create_user',
          resourceType: 'users',
          resourceId: 'user-2',
          details: {},
          ipAddress: '127.0.0.1',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.auditLog.count.mockResolvedValue(100);
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.findAll('tenant-1', { page: 0, limit: 50 });

      expect(result).toEqual({
        data: mockLogs,
        pagination: {
          page: 0,
          limit: 50,
          total: 100,
          totalPages: 2,
        },
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
    });

    it('should apply filters correctly', async () => {
      mockPrismaService.auditLog.count.mockResolvedValue(10);
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      await service.findAll('tenant-1', {
        actorId: 'user-1',
        action: 'create',
        resourceType: 'tickets',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            actorId: 'user-1',
            action: { contains: 'create', mode: 'insensitive' },
            resourceType: 'tickets',
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          },
        }),
      );
    });
  });

  describe('exportCsv', () => {
    it('should generate CSV content', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          actorId: 'user-1',
          actorType: 'user',
          action: 'create_user',
          resourceType: 'users',
          resourceId: 'user-2',
          details: { method: 'POST' },
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-02-16T12:00:00Z'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const csv = await service.exportCsv('tenant-1', {});

      expect(csv).toContain('timestamp,actor_id,actor_type,action');
      expect(csv).toContain('user-1,user,create_user,users,user-2');
      expect(csv).toContain('127.0.0.1');
    });

    it('should escape CSV special characters', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          actorId: 'user-1',
          actorType: 'user',
          action: 'create_user',
          resourceType: 'users',
          resourceId: 'user-2',
          details: { note: 'Contains, comma and "quotes"' },
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-02-16T12:00:00Z'),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const csv = await service.exportCsv('tenant-1', {});

      // Details are JSON stringified, which escapes quotes as \"
      // Then the whole JSON is wrapped in CSV quotes
      expect(csv).toContain('Contains, comma and');
      expect(csv).toContain('"note"');
    });
  });

  describe('purgeOldLogs', () => {
    it('should delete logs older than retention period', async () => {
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 42 });

      const result = await service.purgeOldLogs(90);

      expect(result).toBe(42);

      // Should have called deleteMany with a date filter
      expect(mockPrismaService.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });

      // Verify the date is roughly 90 days ago
      const callArgs = mockPrismaService.auditLog.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const expectedCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedCutoff);

      // Allow 1 second difference for test execution time
      expect(timeDiff).toBeLessThan(1000);
    });

    it('should use default retention of 90 days', async () => {
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 10 });

      await service.purgeOldLogs();

      expect(mockPrismaService.auditLog.deleteMany).toHaveBeenCalled();
    });
  });
});
