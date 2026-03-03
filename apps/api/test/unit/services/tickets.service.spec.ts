import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { TicketsService } from '../../../src/modules/tickets/tickets.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TicketsGateway } from '../../../src/modules/tickets/tickets.gateway';
import { CacheService } from '../../../src/cache/cache.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockApplication = {
    id: 'app-123',
    name: 'Test App',
    platform: 'web',
  };

  const mockReporter = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
  };

  const mockTicket = {
    id: 'ticket-123',
    title: 'Test Ticket',
    description: 'Test description',
    status: 'open',
    type: 'bug',
    severity: 'medium',
    tenantId: 'tenant-123',
    applicationId: 'app-123',
    reporterId: 'user-123',
    assignedTo: null,
    assignedAt: null,
    resolvedAt: null,
    userContext: {},
    reproductionSteps: [],
    sessionId: 'session-123',
    aiSummary: null,
    aiAnalysis: null,
    keywords: [],
    typeConfidence: null,
    severityConfidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    application: mockApplication,
    reporter: mockReporter,
    assignee: null,
    _count: {
      media: 2,
    },
  };

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-123',
    name: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: {
            ticket: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              groupBy: jest.fn(),
            },
            user: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: TicketsGateway,
          useValue: {
            emitTicketCreated: jest.fn(),
            emitTicketUpdated: jest.fn(),
            emitTicketDeleted: jest.fn(),
            emitTicketAssigned: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            getOrSet: jest.fn().mockImplementation((_key: string, _ttl: number, factory: () => Promise<any>) => factory()),
            invalidateByPrefix: jest.fn(),
            hashFilters: jest.fn().mockReturnValue('mock-hash'),
          },
        },
        {
          provide: getQueueToken('github'),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getQueueToken('deep-analysis'),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getQueueToken('triage'),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a ticket with reporter', async () => {
      const dto = {
        title: 'Test Ticket',
        description: 'Test description',
        applicationId: 'app-123',
        userContext: {},
        reproductionSteps: [],
        sessionId: 'session-123',
      };

      (prisma.ticket.create as jest.Mock).mockResolvedValue(mockTicket);

      const result = await service.create('tenant-123', dto, 'user-123');

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          description: dto.description,
          userContext: dto.userContext,
          reproductionSteps: dto.reproductionSteps,
          sessionId: dto.sessionId,
          publicId: expect.any(String),
          tenant: { connect: { id: 'tenant-123' } },
          application: { connect: { id: 'app-123' } },
          reporter: { connect: { id: 'user-123' } },
        },
        include: {
          application: {
            select: {
              id: true,
              name: true,
              platform: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      expect(result).toEqual(mockTicket);
    });

    it('should create a ticket without reporter', async () => {
      const dto = {
        title: 'Test Ticket',
        description: 'Test description',
        applicationId: 'app-123',
        userContext: {},
        reproductionSteps: [],
      };

      const ticketWithoutReporter = { ...mockTicket, reporterId: null, reporter: null };
      (prisma.ticket.create as jest.Mock).mockResolvedValue(ticketWithoutReporter);

      const result = await service.create('tenant-123', dto);

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          reporter: expect.anything(),
        }),
        include: expect.anything(),
      });
      expect(result).toEqual(ticketWithoutReporter);
    });
  });

  describe('findAll', () => {
    it('should return paginated tickets with default filters', async () => {
      const tickets = [mockTicket];
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue(tickets);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('tenant-123', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.objectContaining({
          application: expect.anything(),
          reporter: expect.anything(),
          assignee: expect.anything(),
        }),
      });
      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 0,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      });
    });

    it('should apply filters correctly', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('tenant-123', {
        status: 'open',
        type: 'bug',
        severity: 'high',
        applicationId: 'app-123',
        assignedTo: 'user-123',
        reporterId: 'user-456',
        page: 1,
        limit: 10,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          status: 'open',
          type: 'bug',
          severity: 'high',
          applicationId: 'app-123',
          assignedTo: 'user-123',
          reporterId: 'user-456',
        },
        skip: 10,
        take: 10,
        orderBy: { title: 'asc' },
        include: expect.anything(),
      });
    });

    it('should apply search filter across title, description, and summary', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('tenant-123', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        search: 'login error',
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          OR: [
            { title: { contains: 'login error', mode: 'insensitive' } },
            { description: { contains: 'login error', mode: 'insensitive' } },
            { aiSummary: { contains: 'login error', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.anything(),
      });
    });

    it('should apply date range filters', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);

      const from = '2024-01-01T00:00:00.000Z';
      const to = '2024-12-31T23:59:59.999Z';

      await service.findAll('tenant-123', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
        createdFrom: from,
        createdTo: to,
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          createdAt: {
            gte: new Date(from),
            lte: new Date(to),
          },
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.anything(),
      });
    });

    it('should return empty results when querying with wrong tenant', async () => {
      // tenant-B has no tickets; querying with tenant-B returns empty arrays
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll('tenant-B', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);

      // Confirm the WHERE clause is scoped to tenant-B only
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-B' }),
        }),
      );
      expect(prisma.ticket.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-B' }),
        }),
      );
    });

    it('should convert Decimal confidence values to numbers', async () => {
      const ticketWithConfidence = {
        ...mockTicket,
        typeConfidence: 0.95,
        severityConfidence: 0.87,
      };

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([ticketWithConfidence]);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('tenant-123', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      });

      expect(result.data[0].typeConfidence).toBe(0.95);
      expect(result.data[0].severityConfidence).toBe(0.87);
    });
  });

  describe('findOne', () => {
    it('should return ticket with full details', async () => {
      const detailedTicket = {
        ...mockTicket,
        media: [
          { id: 'media-1', fileSize: 1024, createdAt: new Date() },
          { id: 'media-2', fileSize: 2048, createdAt: new Date() },
        ],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(detailedTicket);

      const result = await service.findOne('ticket-123', 'tenant-123');

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-123', tenantId: 'tenant-123' },
        include: expect.objectContaining({
          application: expect.anything(),
          reporter: expect.anything(),
          assignee: expect.anything(),
          media: expect.anything(),
          githubIssues: expect.anything(),
          agentSessions: expect.anything(),
        }),
      });
      expect(result).toHaveProperty('media');
      expect(result.media).toHaveLength(2);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('missing', 'tenant-123')).rejects.toThrow(
        'Ticket missing not found',
      );
    });

    it('should throw NotFoundException when ticket belongs to a different tenant', async () => {
      // ticket-123 belongs to tenant-A; querying with tenant-B returns null
      // because Prisma filters by both id AND tenantId in the WHERE clause
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('ticket-123', 'tenant-B')).rejects.toThrow(
        NotFoundException,
      );

      // Confirm the query was scoped to tenant-B, not tenant-A
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-123', tenantId: 'tenant-B' },
        }),
      );
    });

    it('should convert Decimal and BigInt values to numbers', async () => {
      const ticketWithNumbers = {
        ...mockTicket,
        typeConfidence: 0.95,
        severityConfidence: 0.87,
        media: [{ id: 'media-1', fileSize: BigInt(1024), createdAt: new Date() }],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithNumbers);

      const result = await service.findOne('ticket-123', 'tenant-123');

      expect(result.typeConfidence).toBe(0.95);
      expect(result.severityConfidence).toBe(0.87);
      expect(result.media[0].fileSize).toBe(1024);
    });
  });

  describe('update', () => {
    it('should update ticket successfully', async () => {
      const dto = {
        title: 'Updated Title',
        description: 'Updated description',
        status: 'in_progress' as const,
      };

      const updatedTicket = { ...mockTicket, ...dto };
      const ticketWithMedia = {
        ...mockTicket,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (prisma.ticket.update as jest.Mock).mockResolvedValue(updatedTicket);

      const result = await service.update('ticket-123', 'tenant-123', dto);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          title: 'Updated Title',
          description: 'Updated description',
          status: 'in_progress',
          resolvedAt: null,
        },
        include: {
          application: true,
          reporter: true,
          assignee: true,
        },
      });
      expect(result).toEqual(expect.objectContaining(dto));
    });

    it('should set resolvedAt when status is resolved', async () => {
      const dto = { status: 'resolved' as const };

      const ticketWithMedia = {
        ...mockTicket,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        status: 'resolved',
        resolvedAt: expect.any(Date),
      });

      await service.update('ticket-123', 'tenant-123', dto);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(Date),
        }),
        include: expect.anything(),
      });
    });

    it('should clear resolvedAt when status changes from resolved', async () => {
      const dto = { status: 'open' as const };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({
        ...mockTicket,
        status: 'resolved',
        resolvedAt: new Date(),
        media: [],
        githubIssues: [],
        agentSessions: [],
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        status: 'open',
        resolvedAt: null,
      });

      await service.update('ticket-123', 'tenant-123', dto);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({
          status: 'open',
          resolvedAt: null,
        }),
        include: expect.anything(),
      });
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('missing', 'tenant-123', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when updating ticket from different tenant', async () => {
      // ticket-123 belongs to tenant-A; tenant-B's findFirst call returns null
      // because update() calls findOne() internally, which scopes by tenantId
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('ticket-123', 'tenant-B', { title: 'Hijacked Title' }),
      ).rejects.toThrow(NotFoundException);

      // The internal findOne call must use tenant-B — not tenant-A
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-123', tenantId: 'tenant-B' },
        }),
      );

      // The update itself must NOT have been called
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('should update AI analysis fields', async () => {
      const dto = {
        type: 'bug' as const,
        severity: 'high' as const,
        aiSummary: 'AI generated summary',
        aiAnalysis: { confidence: 0.95 },
      };

      const ticketWithMedia = {
        ...mockTicket,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        ...dto,
      });

      await service.update('ticket-123', 'tenant-123', dto);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({
          type: 'bug',
          severity: 'high',
          aiSummary: 'AI generated summary',
          aiAnalysis: { confidence: 0.95 },
        }),
        include: expect.anything(),
      });
    });
  });

  describe('remove', () => {
    it('should soft delete ticket by setting status to closed', async () => {
      const ticketWithMedia = {
        ...mockTicket,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        status: 'closed',
        resolvedAt: expect.any(Date),
      });

      const result = await service.remove('ticket-123', 'tenant-123');

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          status: 'closed',
          resolvedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('closed');
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assign', () => {
    it('should assign ticket to user', async () => {
      const ticketWithMedia = {
        ...mockTicket,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        assignedTo: 'user-123',
        assignedAt: expect.any(Date),
        assignee: mockUser,
      });

      const result = await service.assign('ticket-123', 'tenant-123', 'user-123');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-123', tenantId: 'tenant-123' },
      });
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          assignedTo: 'user-123',
          assignedAt: expect.any(Date),
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      expect(result.assignedTo).toBe('user-123');
    });

    it('should unassign ticket when userId is null', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue({
        ...mockTicket,
        assignedTo: 'user-123',
        media: [],
        githubIssues: [],
        agentSessions: [],
      });
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        assignedTo: null,
        assignedAt: null,
      });

      const result = await service.assign('ticket-123', 'tenant-123', null);

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          assignedTo: null,
          assignedAt: null,
        },
        include: expect.anything(),
      });
      expect(result.assignedTo).toBeNull();
    });

    it('should throw ForbiddenException when user not in tenant', async () => {
      const ticketWithMedia = {
        ...mockTicket,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };

      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.assign('ticket-123', 'tenant-123', 'other-user'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.assign('ticket-123', 'tenant-123', 'other-user'),
      ).rejects.toThrow('User not found or does not belong to this tenant');
    });

    it('should throw NotFoundException when ticket not found', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.assign('missing', 'tenant-123', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return ticket statistics', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(15); // recent

      (prisma.ticket.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'open', _count: 40 },
          { status: 'in_progress', _count: 35 },
          { status: 'resolved', _count: 20 },
          { status: 'closed', _count: 5 },
        ])
        .mockResolvedValueOnce([
          { severity: 'low', _count: 30 },
          { severity: 'medium', _count: 50 },
          { severity: 'high', _count: 15 },
          { severity: 'critical', _count: 5 },
        ])
        .mockResolvedValueOnce([
          { type: 'bug', _count: 60 },
          { type: 'feature', _count: 25 },
          { type: 'question', _count: 15 },
        ]);

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([
        {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          resolvedAt: new Date('2024-01-02T12:00:00Z'),
        },
        {
          createdAt: new Date('2024-01-03T00:00:00Z'),
          resolvedAt: new Date('2024-01-04T00:00:00Z'),
        },
      ]);

      const result = await service.getStats('tenant-123');

      expect(result).toEqual({
        total: 100,
        byStatus: {
          open: 40,
          in_progress: 35,
          resolved: 20,
          closed: 5,
        },
        bySeverity: {
          low: 30,
          medium: 50,
          high: 15,
          critical: 5,
        },
        byType: {
          bug: 60,
          feature: 25,
          question: 15,
        },
        recentTickets: 15,
        avgResolutionTimeHours: expect.any(Number),
      });
    });

    it('should handle zero resolved tickets for average resolution time', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10);

      (prisma.ticket.groupBy as jest.Mock)
        .mockResolvedValueOnce([{ status: 'open', _count: 50 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getStats('tenant-123');

      expect(result.avgResolutionTimeHours).toBe(0);
    });

    it('should format groupBy results with unknown for null values', async () => {
      (prisma.ticket.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2);

      (prisma.ticket.groupBy as jest.Mock)
        .mockResolvedValueOnce([{ status: 'open', _count: 10 }])
        .mockResolvedValueOnce([{ severity: null, _count: 5 }])
        .mockResolvedValueOnce([{ type: null, _count: 3 }]);

      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getStats('tenant-123');

      expect(result.bySeverity).toEqual({ unknown: 5 });
      expect(result.byType).toEqual({ unknown: 3 });
    });
  });

  describe('Multi-tenant Prisma query inspection', () => {
    const TENANT_X = 'tenant-X';

    it('should include tenantId in findOne WHERE clause', async () => {
      const detailedTicket = {
        ...mockTicket,
        tenantId: TENANT_X,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(detailedTicket);

      await service.findOne('ticket-123', TENANT_X);

      const [callArgs] = (prisma.ticket.findFirst as jest.Mock).mock.calls;
      expect(callArgs[0].where).toMatchObject({ tenantId: TENANT_X });
    });

    it('should include tenantId in findAll WHERE clause for both findMany and count', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ticket.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(TENANT_X, {
        page: 0,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      });

      const findManyArgs = (prisma.ticket.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs.where).toMatchObject({ tenantId: TENANT_X });

      const countArgs = (prisma.ticket.count as jest.Mock).mock.calls[0][0];
      expect(countArgs.where).toMatchObject({ tenantId: TENANT_X });
    });

    it('should include tenantId in update — via internal findOne call', async () => {
      // update() delegates ownership check to findOne(), which uses tenantId in WHERE
      const existingTicket = {
        ...mockTicket,
        tenantId: TENANT_X,
        media: [],
        githubIssues: [],
        agentSessions: [],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(existingTicket);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({
        ...mockTicket,
        tenantId: TENANT_X,
        title: 'Updated',
      });

      await service.update('ticket-123', TENANT_X, { title: 'Updated' });

      const findFirstArgs = (prisma.ticket.findFirst as jest.Mock).mock.calls[0][0];
      expect(findFirstArgs.where).toMatchObject({ tenantId: TENANT_X });
    });
  });
});
