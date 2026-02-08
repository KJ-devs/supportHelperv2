import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto, UpdateTicketDto, FilterTicketsDto } from './dto';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: PrismaService;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockApplicationId = 'app-123';
  const mockTicketId = 'ticket-123';

  const mockTicket = {
    id: mockTicketId,
    tenantId: mockTenantId,
    applicationId: mockApplicationId,
    reporterId: mockUserId,
    title: 'Login button not working',
    description: 'When I click login, nothing happens',
    status: 'new',
    type: 'bug',
    severity: 'high',
    typeConfidence: 0.95,
    severityConfidence: 0.88,
    priority: 0,
    aiSummary: null,
    aiAnalysis: null,
    keywords: [],
    userContext: {
      os: 'Windows 11',
      browser: 'Chrome 120',
    },
    reproductionSteps: ['Open app', 'Click login'],
    sessionId: 'session-123',
    assignedTo: null,
    assignedAt: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    resolvedAt: null,
    application: {
      id: mockApplicationId,
      name: 'Test App',
      platform: 'web',
    },
    reporter: {
      id: mockUserId,
      name: 'Test User',
      email: 'test@example.com',
    },
    assignee: null,
    _count: {
      media: 2,
    },
  };

  const mockPrismaService = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateTicketDto = {
      title: 'Login button not working',
      description: 'When I click login, nothing happens',
      applicationId: mockApplicationId,
      userContext: {
        os: 'Windows 11',
        browser: 'Chrome 120',
      },
      reproductionSteps: ['Open app', 'Click login'],
      sessionId: 'session-123',
    };

    it('should create a ticket successfully', async () => {
      mockPrismaService.ticket.create.mockResolvedValue(mockTicket);

      const result = await service.create(mockTenantId, createDto, mockUserId);

      expect(result).toEqual(mockTicket);
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: createDto.title,
          description: createDto.description,
          userContext: createDto.userContext,
          reproductionSteps: createDto.reproductionSteps,
          sessionId: createDto.sessionId,
          tenant: {
            connect: { id: mockTenantId },
          },
          application: {
            connect: { id: mockApplicationId },
          },
          reporter: {
            connect: { id: mockUserId },
          },
        }),
        include: expect.objectContaining({
          application: expect.any(Object),
          reporter: expect.any(Object),
        }),
      });
    });

    it('should create a ticket without reporter (SDK ticket)', async () => {
      const ticketWithoutReporter = { ...mockTicket, reporterId: null, reporter: null };
      mockPrismaService.ticket.create.mockResolvedValue(ticketWithoutReporter);

      const result = await service.create(mockTenantId, createDto, undefined);

      expect(result.reporterId).toBeNull();
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          reporter: expect.anything(),
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    const filterDto: FilterTicketsDto = {
      page: 0,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    it('should return paginated tickets', async () => {
      const tickets = [mockTicket];
      const totalCount = 1;

      mockPrismaService.ticket.findMany.mockResolvedValue(tickets);
      mockPrismaService.ticket.count.mockResolvedValue(totalCount);

      const result = await service.findAll(mockTenantId, filterDto);

      expect(result.data).toEqual(tickets);
      expect(result.pagination).toEqual({
        page: 0,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: mockTenantId },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(0);

      await service.findAll(mockTenantId, { ...filterDto, status: 'open' });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            status: 'open',
          }),
        }),
      );
    });

    it('should filter by type and severity', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(0);

      await service.findAll(mockTenantId, {
        ...filterDto,
        type: 'bug',
        severity: 'critical',
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            type: 'bug',
            severity: 'critical',
          }),
        }),
      );
    });

    it('should filter by applicationId, assignedTo, and reporterId', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(0);

      await service.findAll(mockTenantId, {
        ...filterDto,
        applicationId: mockApplicationId,
        assignedTo: mockUserId,
        reporterId: mockUserId,
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            applicationId: mockApplicationId,
            assignedTo: mockUserId,
            reporterId: mockUserId,
          }),
        }),
      );
    });

    it('should support text search', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(0);

      await service.findAll(mockTenantId, {
        ...filterDto,
        search: 'login error',
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            OR: expect.arrayContaining([
              { title: { contains: 'login error', mode: 'insensitive' } },
              { description: { contains: 'login error', mode: 'insensitive' } },
              { aiSummary: { contains: 'login error', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(0);

      const from = '2024-01-01T00:00:00Z';
      const to = '2024-01-31T23:59:59Z';

      await service.findAll(mockTenantId, {
        ...filterDto,
        createdFrom: from,
        createdTo: to,
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
            createdAt: {
              gte: new Date(from),
              lte: new Date(to),
            },
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(45);

      const result = await service.findAll(mockTenantId, {
        ...filterDto,
        page: 1,
        limit: 20,
      });

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
        hasMore: true,
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a ticket by ID', async () => {
      const detailedTicket = {
        ...mockTicket,
        media: [
          {
            id: 'media-1',
            type: 'video',
            storageKey: 'key1',
            createdAt: new Date(),
          },
        ],
        githubIssues: [],
        agentSessions: [],
      };

      mockPrismaService.ticket.findFirst.mockResolvedValue(detailedTicket);

      const result = await service.findOne(mockTicketId, mockTenantId);

      expect(result).toEqual(detailedTicket);
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTicketId,
          tenantId: mockTenantId,
        },
        include: expect.objectContaining({
          application: expect.any(Object),
          reporter: expect.any(Object),
          assignee: expect.any(Object),
          media: expect.any(Object),
          githubIssues: expect.any(Object),
          agentSessions: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockTicketId, mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(mockTicketId, 'different-tenant'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: mockTicketId,
            tenantId: 'different-tenant',
          },
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateTicketDto = {
      title: 'Updated title',
      status: 'in_progress',
      severity: 'critical',
    };

    it('should update a ticket successfully', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      const updatedTicket = { ...mockTicket, ...updateDto };
      mockPrismaService.ticket.update.mockResolvedValue(updatedTicket);

      const result = await service.update(mockTicketId, mockTenantId, updateDto);

      expect(result.title).toBe(updateDto.title);
      expect(result.status).toBe(updateDto.status);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          title: updateDto.title,
          status: updateDto.status,
          severity: updateDto.severity,
        }),
        include: expect.any(Object),
      });
    });

    it('should set resolvedAt when status changes to resolved', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      const resolvedTicket = { ...mockTicket, status: 'resolved', resolvedAt: new Date() };
      mockPrismaService.ticket.update.mockResolvedValue(resolvedTicket);

      await service.update(mockTicketId, mockTenantId, { status: 'resolved' });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });

    it('should clear resolvedAt when status changes from resolved', async () => {
      const resolvedTicket = { ...mockTicket, status: 'resolved', resolvedAt: new Date() };
      mockPrismaService.ticket.findFirst.mockResolvedValue(resolvedTicket);
      mockPrismaService.ticket.update.mockResolvedValue({ ...resolvedTicket, status: 'open', resolvedAt: null });

      await service.update(mockTicketId, mockTenantId, { status: 'open' });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: expect.objectContaining({
          status: 'open',
          resolvedAt: null,
        }),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockTicketId, mockTenantId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a ticket', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      const closedTicket = {
        ...mockTicket,
        status: 'closed',
        resolvedAt: new Date(),
      };
      mockPrismaService.ticket.update.mockResolvedValue(closedTicket);

      const result = await service.remove(mockTicketId, mockTenantId);

      expect(result.status).toBe('closed');
      expect(result.resolvedAt).toBeDefined();
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: {
          status: 'closed',
          resolvedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(mockTicketId, mockTenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign', () => {
    const assigneeId = 'user-456';
    const mockAssignee = {
      id: assigneeId,
      tenantId: mockTenantId,
      email: 'assignee@example.com',
      name: 'Assignee User',
      role: 'member',
      passwordHash: 'hash',
      authProvider: 'email',
      authProviderId: null,
      createdAt: new Date(),
    };

    it('should assign ticket to a user', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.user.findFirst.mockResolvedValue(mockAssignee);
      const assignedTicket = {
        ...mockTicket,
        assignedTo: assigneeId,
        assignedAt: new Date(),
        assignee: {
          id: assigneeId,
          name: 'Assignee User',
          email: 'assignee@example.com',
        },
      };
      mockPrismaService.ticket.update.mockResolvedValue(assignedTicket);

      const result = await service.assign(mockTicketId, mockTenantId, assigneeId);

      expect(result.assignedTo).toBe(assigneeId);
      expect(result.assignedAt).toBeDefined();
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: {
          assignedTo: assigneeId,
          assignedAt: expect.any(Date),
        },
        include: expect.objectContaining({
          assignee: expect.any(Object),
        }),
      });
    });

    it('should unassign ticket when userId is null', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      const unassignedTicket = {
        ...mockTicket,
        assignedTo: null,
        assignedAt: null,
        assignee: null,
      };
      mockPrismaService.ticket.update.mockResolvedValue(unassignedTicket);

      const result = await service.assign(mockTicketId, mockTenantId, null);

      expect(result.assignedTo).toBeNull();
      expect(result.assignedAt).toBeNull();
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: mockTicketId },
        data: {
          assignedTo: null,
          assignedAt: null,
        },
        include: expect.any(Object),
      });
    });

    it('should throw ForbiddenException if user not in same tenant', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.assign(mockTicketId, mockTenantId, assigneeId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.assign(mockTicketId, mockTenantId, assigneeId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return ticket statistics', async () => {
      mockPrismaService.ticket.count.mockResolvedValue(100);
      mockPrismaService.ticket.groupBy
        .mockResolvedValueOnce([
          { status: 'new', _count: 30 },
          { status: 'open', _count: 25 },
          { status: 'in_progress', _count: 20 },
          { status: 'resolved', _count: 25 },
        ])
        .mockResolvedValueOnce([
          { severity: 'critical', _count: 10 },
          { severity: 'high', _count: 30 },
          { severity: 'medium', _count: 40 },
          { severity: 'low', _count: 20 },
        ])
        .mockResolvedValueOnce([
          { type: 'bug', _count: 60 },
          { type: 'feature_request', _count: 30 },
          { type: 'question', _count: 10 },
        ]);

      mockPrismaService.ticket.findMany.mockResolvedValue([
        {
          createdAt: new Date('2024-01-10T10:00:00Z'),
          resolvedAt: new Date('2024-01-11T10:00:00Z'), // 24 hours
        },
        {
          createdAt: new Date('2024-01-12T10:00:00Z'),
          resolvedAt: new Date('2024-01-14T10:00:00Z'), // 48 hours
        },
      ]);

      const result = await service.getStats(mockTenantId);

      expect(result.total).toBe(100);
      expect(result.byStatus).toEqual({
        new: 30,
        open: 25,
        in_progress: 20,
        resolved: 25,
      });
      expect(result.bySeverity).toEqual({
        critical: 10,
        high: 30,
        medium: 40,
        low: 20,
      });
      expect(result.byType).toEqual({
        bug: 60,
        feature_request: 30,
        question: 10,
      });
      expect(result.avgResolutionTimeHours).toBe(36); // (24 + 48) / 2
    });

    it('should return 0 for avgResolutionTime when no resolved tickets', async () => {
      mockPrismaService.ticket.count.mockResolvedValue(10);
      mockPrismaService.ticket.groupBy.mockResolvedValue([]);
      mockPrismaService.ticket.findMany.mockResolvedValue([]);

      const result = await service.getStats(mockTenantId);

      expect(result.avgResolutionTimeHours).toBe(0);
    });
  });
});
