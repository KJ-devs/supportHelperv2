import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsSearchService } from './tickets-search.service';
import { TicketsAIService } from './tickets-ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  CreateTicketDto,
  UpdateTicketDto,
  FilterTicketsDto,
  SearchTicketsDto,
  AssignTicketDto,
} from './dto';

// Local type aliases for mock return values (avoids complex Prisma inferred types)
type TicketResult = Awaited<ReturnType<TicketsService['findOne']>>;
type TicketUpdateResult = Awaited<ReturnType<TicketsService['update']>>;
type TicketRemoveResult = Awaited<ReturnType<TicketsService['remove']>>;
type TicketAssignResult = Awaited<ReturnType<TicketsService['assign']>>;
type PaginatedResult = Awaited<ReturnType<TicketsService['findAll']>>;
type SearchResult = Awaited<ReturnType<TicketsSearchService['search']>>;

describe('TicketsController', () => {
  let controller: TicketsController;
  let ticketsService: TicketsService;
  let searchService: TicketsSearchService;
  let aiService: TicketsAIService;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockTicketId = 'ticket-123';
  const mockApplicationId = 'app-123';

  const mockTicket: Record<string, unknown> = {
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

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'meilisearch.host') return 'http://localhost:7700';
      if (key === 'meilisearch.apiKey') return 'test-key';
      if (key === 'database.redisUrl') return 'redis://localhost:6379';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        TicketsService,
        {
          provide: TicketsSearchService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
            indexTicket: jest.fn(),
            updateTicket: jest.fn(),
            removeTicket: jest.fn(),
            search: jest.fn(),
          },
        },
        {
          provide: TicketsAIService,
          useValue: {
            enqueueAnalysis: jest.fn(),
            findSimilar: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    ticketsService = module.get<TicketsService>(TicketsService);
    searchService = module.get<TicketsSearchService>(TicketsSearchService);
    aiService = module.get<TicketsAIService>(TicketsAIService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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

    it('should create a ticket and trigger AI analysis', async () => {
      mockPrismaService.ticket.create.mockResolvedValue(mockTicket);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(aiService, 'enqueueAnalysis').mockResolvedValue();

      const result = await controller.create(mockTenantId, mockUserId, createDto);

      expect(result).toEqual(mockTicket);
      expect(aiService.enqueueAnalysis).toHaveBeenCalledWith(mockTicketId);
    });

    it('should index ticket in Meilisearch if enabled', async () => {
      mockPrismaService.ticket.create.mockResolvedValue(mockTicket);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(searchService, 'indexTicket').mockResolvedValue();
      jest.spyOn(aiService, 'enqueueAnalysis').mockResolvedValue();

      await controller.create(mockTenantId, mockUserId, createDto);

      expect(searchService.indexTicket).toHaveBeenCalledWith(mockTicket);
    });

    it('should not index in Meilisearch if disabled', async () => {
      mockPrismaService.ticket.create.mockResolvedValue(mockTicket);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(false);
      jest.spyOn(searchService, 'indexTicket').mockResolvedValue();
      jest.spyOn(aiService, 'enqueueAnalysis').mockResolvedValue();

      await controller.create(mockTenantId, mockUserId, createDto);

      expect(searchService.indexTicket).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated tickets', async () => {
      const paginatedResult = {
        data: [mockTicket],
        pagination: {
          page: 0,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      };

      jest.spyOn(ticketsService, 'findAll').mockResolvedValue(paginatedResult as unknown as PaginatedResult);

      const result = await controller.findAll(mockTenantId, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result).toEqual(paginatedResult);
      expect(ticketsService.findAll).toHaveBeenCalledWith(mockTenantId, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('should pass filters to service', async () => {
      const filters: FilterTicketsDto = {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: 'open',
        severity: 'critical',
        type: 'bug',
      };

      jest.spyOn(ticketsService, 'findAll').mockResolvedValue({
        data: [],
        pagination: {
          page: 0,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      } as unknown as PaginatedResult);

      await controller.findAll(mockTenantId, filters);

      expect(ticketsService.findAll).toHaveBeenCalledWith(mockTenantId, filters);
    });
  });

  describe('getStats', () => {
    it('should return ticket statistics', async () => {
      const stats = {
        total: 100,
        byStatus: { new: 30, open: 40, resolved: 30 },
        bySeverity: { critical: 10, high: 30, medium: 40, low: 20 },
        byType: { bug: 60, feature_request: 30, question: 10 },
        recentTickets: 15,
        avgResolutionTimeHours: 36,
      };

      jest.spyOn(ticketsService, 'getStats').mockResolvedValue(stats);

      const result = await controller.getStats(mockTenantId);

      expect(result).toEqual(stats);
      expect(ticketsService.getStats).toHaveBeenCalledWith(mockTenantId);
    });
  });

  describe('findOne', () => {
    it('should return a ticket by ID', async () => {
      jest.spyOn(ticketsService, 'findOne').mockResolvedValue(mockTicket as unknown as TicketResult);

      const result = await controller.findOne(mockTenantId, mockTicketId);

      expect(result).toEqual(mockTicket);
      expect(ticketsService.findOne).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
      );
    });

    it('should throw NotFoundException if ticket not found', async () => {
      jest
        .spyOn(ticketsService, 'findOne')
        .mockRejectedValue(new NotFoundException());

      await expect(
        controller.findOne(mockTenantId, mockTicketId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findSimilar', () => {
    it('should return similar tickets', async () => {
      const similarTickets = [
        {
          id: 'ticket-456',
          title: 'Login form broken',
          similarity: 0.92,
        },
        {
          id: 'ticket-789',
          title: 'Cannot authenticate',
          similarity: 0.85,
        },
      ];

      jest.spyOn(aiService, 'findSimilar').mockResolvedValue(similarTickets);

      const result = await controller.findSimilar(mockTenantId, mockTicketId, 5);

      expect(result).toEqual(similarTickets);
      expect(aiService.findSimilar).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
        5,
      );
    });

    it('should use default limit if not provided', async () => {
      jest.spyOn(aiService, 'findSimilar').mockResolvedValue([]);

      await controller.findSimilar(mockTenantId, mockTicketId);

      expect(aiService.findSimilar).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
        5,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateTicketDto = {
      title: 'Updated title',
      status: 'in_progress',
    };

    it('should update a ticket', async () => {
      const updatedTicket = { ...mockTicket, ...updateDto };
      jest.spyOn(ticketsService, 'update').mockResolvedValue(updatedTicket as unknown as TicketUpdateResult);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(false);

      const result = await controller.update(
        mockTenantId,
        mockTicketId,
        updateDto,
      );

      expect(result).toEqual(updatedTicket);
      expect(ticketsService.update).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
        updateDto,
      );
    });

    it('should update ticket in Meilisearch if enabled', async () => {
      const updatedTicket = { ...mockTicket, ...updateDto };
      jest.spyOn(ticketsService, 'update').mockResolvedValue(updatedTicket as unknown as TicketUpdateResult);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(searchService, 'updateTicket').mockResolvedValue();

      await controller.update(mockTenantId, mockTicketId, updateDto);

      expect(searchService.updateTicket).toHaveBeenCalledWith(updatedTicket);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      jest
        .spyOn(ticketsService, 'update')
        .mockRejectedValue(new NotFoundException());

      await expect(
        controller.update(mockTenantId, mockTicketId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assign', () => {
    const assignDto: AssignTicketDto = {
      userId: 'user-456',
    };

    it('should assign a ticket to user', async () => {
      const assignedTicket = {
        ...mockTicket,
        assignedTo: assignDto.userId,
        assignedAt: new Date(),
        assignee: {
          id: assignDto.userId!,
          name: 'Assignee',
          email: 'assignee@example.com',
        },
      };

      jest.spyOn(ticketsService, 'assign').mockResolvedValue(assignedTicket as unknown as TicketAssignResult);

      const result = await controller.assign(
        mockTenantId,
        mockTicketId,
        assignDto,
      );

      expect(result).toEqual(assignedTicket);
      expect(ticketsService.assign).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
        assignDto.userId,
      );
    });

    it('should unassign a ticket when userId is null', async () => {
      const unassignedTicket = {
        ...mockTicket,
        assignedTo: null,
        assignedAt: null,
        assignee: null,
      };

      jest.spyOn(ticketsService, 'assign').mockResolvedValue(unassignedTicket as unknown as TicketResult);

      await controller.assign(mockTenantId, mockTicketId, { userId: null });

      expect(ticketsService.assign).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
        null,
      );
    });

    it('should throw ForbiddenException if user not in tenant', async () => {
      jest
        .spyOn(ticketsService, 'assign')
        .mockRejectedValue(new ForbiddenException());

      await expect(
        controller.assign(mockTenantId, mockTicketId, assignDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should soft delete a ticket', async () => {
      const deletedTicket = {
        ...mockTicket,
        status: 'closed',
        resolvedAt: new Date(),
      };

      jest.spyOn(ticketsService, 'remove').mockResolvedValue(deletedTicket as unknown as TicketRemoveResult);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(false);

      const result = await controller.remove(mockTenantId, mockTicketId);

      expect(result.status).toBe('closed');
      expect(ticketsService.remove).toHaveBeenCalledWith(
        mockTicketId,
        mockTenantId,
      );
    });

    it('should remove ticket from Meilisearch if enabled', async () => {
      const deletedTicket = {
        ...mockTicket,
        status: 'closed',
        resolvedAt: new Date(),
      };

      jest.spyOn(ticketsService, 'remove').mockResolvedValue(deletedTicket as unknown as TicketRemoveResult);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(searchService, 'removeTicket').mockResolvedValue();

      await controller.remove(mockTenantId, mockTicketId);

      expect(searchService.removeTicket).toHaveBeenCalledWith(mockTicketId);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      jest
        .spyOn(ticketsService, 'remove')
        .mockRejectedValue(new NotFoundException());

      await expect(
        controller.remove(mockTenantId, mockTicketId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    const searchDto: SearchTicketsDto = {
      query: 'login error',
      limit: 20,
      offset: 0,
    };

    it('should search tickets using Meilisearch', async () => {
      const searchResults = {
        hits: [
          {
            id: mockTicketId,
            title: 'Login button not working',
            status: 'new',
          },
        ],
        totalHits: 1,
        query: 'login error',
        processingTimeMs: 5,
        limit: 20,
        offset: 0,
      };

      jest.spyOn(searchService, 'search').mockResolvedValue(searchResults as unknown as SearchResult);

      const result = await controller.search(mockTenantId, searchDto);

      expect(result).toEqual(searchResults);
      expect(searchService.search).toHaveBeenCalledWith(mockTenantId, searchDto);
    });

    it('should apply filters in search', async () => {
      const searchWithFilters: SearchTicketsDto = {
        ...searchDto,
        status: 'open,in_progress',
        severity: 'critical,high',
        type: 'bug',
      };

      jest.spyOn(searchService, 'search').mockResolvedValue({
        hits: [],
        totalHits: 0,
        query: searchDto.query,
        processingTimeMs: 2,
        limit: 20,
        offset: 0,
      });

      await controller.search(mockTenantId, searchWithFilters);

      expect(searchService.search).toHaveBeenCalledWith(
        mockTenantId,
        searchWithFilters,
      );
    });
  });

  describe('Integration - Full ticket lifecycle', () => {
    it('should handle complete ticket workflow', async () => {
      // 1. Create ticket
      const createDto: CreateTicketDto = {
        title: 'Bug in checkout',
        description: 'Payment fails',
        applicationId: mockApplicationId,
      };

      mockPrismaService.ticket.create.mockResolvedValue(mockTicket);
      jest.spyOn(searchService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(searchService, 'indexTicket').mockResolvedValue();
      jest.spyOn(aiService, 'enqueueAnalysis').mockResolvedValue();

      const createdTicket = await controller.create(
        mockTenantId,
        mockUserId,
        createDto,
      );
      expect(createdTicket).toBeDefined();

      // 2. Update ticket
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      const updatedTicket = { ...mockTicket, status: 'in_progress' };
      mockPrismaService.ticket.update.mockResolvedValue(updatedTicket);
      jest.spyOn(searchService, 'updateTicket').mockResolvedValue();

      await controller.update(mockTenantId, mockTicketId, {
        status: 'in_progress',
      });

      // 3. Assign ticket
      const assigneeId = 'user-789';
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: assigneeId,
        tenantId: mockTenantId,
        email: 'assignee@example.com',
        name: 'Assignee',
        role: 'member',
        passwordHash: 'hash',
        authProvider: 'email',
        authProviderId: null,
        createdAt: new Date(),
      });

      const assignedTicket = {
        ...updatedTicket,
        assignedTo: assigneeId,
        assignedAt: new Date(),
      };
      mockPrismaService.ticket.update.mockResolvedValue(assignedTicket);

      await controller.assign(mockTenantId, mockTicketId, {
        userId: assigneeId,
      });

      // 4. Resolve ticket
      const resolvedTicket = {
        ...assignedTicket,
        status: 'resolved',
        resolvedAt: new Date(),
      };
      mockPrismaService.ticket.update.mockResolvedValue(resolvedTicket);

      const result = await controller.update(mockTenantId, mockTicketId, {
        status: 'resolved',
      });

      expect(result.status).toBe('resolved');
      expect(result.resolvedAt).toBeDefined();
    });
  });

  describe('Tenant Isolation', () => {
    it('should not allow access to tickets from different tenant', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(
        controller.findOne('different-tenant', mockTicketId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter tickets by tenantId in findAll', async () => {
      mockPrismaService.ticket.findMany.mockResolvedValue([]);
      mockPrismaService.ticket.count.mockResolvedValue(0);
      jest.spyOn(ticketsService, 'findAll').mockResolvedValue({
        data: [],
        pagination: {
          page: 0,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      } as unknown as PaginatedResult);

      await controller.findAll('different-tenant', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(ticketsService.findAll).toHaveBeenCalledWith(
        'different-tenant',
        expect.any(Object),
      );
    });
  });
});
