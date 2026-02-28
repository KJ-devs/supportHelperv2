import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { TicketsService } from '@/modules/tickets/tickets.service';
import { TicketsGateway } from '@/modules/tickets/tickets.gateway';
import { CacheService } from '@/cache';

/**
 * Ticket Flow Integration Tests
 *
 * Tests the complete ticket lifecycle:
 * create -> findAll -> findOne -> update (AI analysis) -> assign -> resolve -> remove
 *
 * Uses mocked Prisma but tests real service logic and interactions.
 */
describe('Ticket Flow Integration', () => {
  let ticketsService: TicketsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let mockGateway: Record<string, jest.Mock>;
  let mockCacheService: Record<string, jest.Mock>;
  let mockGithubQueue: { add: jest.Mock };

  const tenantId = 'tenant-001';
  const applicationId = 'app-001';

  const baseMockTicket = {
    id: 'ticket-001',
    tenantId,
    applicationId,
    publicId: 'abc123',
    title: 'Login button is broken',
    description: 'The login button does not respond on mobile',
    status: 'new',
    type: 'bug',
    severity: 'medium',
    priority: 1,
    keywords: [],
    typeConfidence: null,
    severityConfidence: null,
    aiSummary: null,
    aiAnalysis: null,
    assignedTo: null,
    reporterId: null,
    resolvedAt: null,
    sessionId: null,
    reproductionSteps: null,
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
    application: { id: applicationId, name: 'Web App', platform: 'web' },
    reporter: null,
    assignee: null,
    media: [],
    githubIssues: [],
    agentSessions: [],
  };

  beforeEach(async () => {
    prisma = {
      ticket: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    mockGateway = {
      emitTicketCreated: jest.fn(),
      emitTicketUpdated: jest.fn(),
      emitTicketDeleted: jest.fn(),
      emitTicketAssigned: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
      invalidateByPrefix: jest.fn().mockResolvedValue(undefined),
      hashFilters: jest.fn().mockReturnValue('hash'),
    };

    mockGithubQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-001' }),
    };

    const mockDeepAnalysisQueue = { add: jest.fn().mockResolvedValue({ id: 'job-da-001' }) };
    const mockTriageQueue = { add: jest.fn().mockResolvedValue({ id: 'job-triage-001' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsGateway, useValue: mockGateway },
        { provide: CacheService, useValue: mockCacheService },
        { provide: getQueueToken('github'), useValue: mockGithubQueue },
        { provide: getQueueToken('deep-analysis'), useValue: mockDeepAnalysisQueue },
        { provide: getQueueToken('triage'), useValue: mockTriageQueue },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
  });

  describe('create -> findOne -> update -> resolve flow', () => {
    it('should create a ticket and emit real-time event', async () => {
      prisma.ticket.create.mockResolvedValue({
        ...baseMockTicket,
        application: { id: applicationId, name: 'Web App', platform: 'web' },
        reporter: null,
      });

      const ticket = await ticketsService.create(tenantId, {
        title: 'Login button is broken',
        description: 'The login button does not respond on mobile',
        applicationId,
      });

      expect(ticket.id).toBe('ticket-001');
      expect(ticket.title).toBe('Login button is broken');

      // Should emit WebSocket event
      expect(mockGateway.emitTicketCreated).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ id: 'ticket-001' }),
      );

      // Should invalidate caches
      expect(mockCacheService.invalidateByPrefix).toHaveBeenCalled();
    });

    it('should retrieve the created ticket by ID', async () => {
      prisma.ticket.findFirst.mockResolvedValue(baseMockTicket);

      const ticket = await ticketsService.findOne('ticket-001', tenantId);

      expect(ticket.id).toBe('ticket-001');
      expect(ticket.title).toBe('Login button is broken');
      expect(ticket.status).toBe('new');
    });

    it('should reject access to ticket from wrong tenant', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.findOne('ticket-001', 'other-tenant'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update ticket with AI analysis data', async () => {
      // findOne is called internally by update to verify ownership
      prisma.ticket.findFirst.mockResolvedValue(baseMockTicket);

      const updatedTicket = {
        ...baseMockTicket,
        aiSummary: 'Mobile login button unresponsive due to touch event handler bug',
        aiAnalysis: {
          severity: 'high',
          severityConfidence: 0.85,
          type: 'bug',
          typeConfidence: 0.95,
          keywords: ['mobile', 'login', 'button', 'touch'],
          processedAt: '2026-02-01T12:00:00Z',
        },
        type: 'bug',
        severity: 'high',
        application: { id: applicationId, name: 'Web App', platform: 'web', githubRepo: null },
        reporter: null,
        assignee: null,
      };
      prisma.ticket.update.mockResolvedValue(updatedTicket);

      const result = await ticketsService.update('ticket-001', tenantId, {
        aiSummary: 'Mobile login button unresponsive due to touch event handler bug',
        aiAnalysis: {
          severity: 'high',
          severityConfidence: 0.85,
          type: 'bug',
          typeConfidence: 0.95,
          keywords: ['mobile', 'login', 'button', 'touch'],
          processedAt: '2026-02-01T12:00:00Z',
        },
        type: 'bug' as unknown,
        severity: 'high' as unknown,
      });

      expect(result.aiSummary).toBe(
        'Mobile login button unresponsive due to touch event handler bug',
      );
      expect(mockGateway.emitTicketUpdated).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ aiSummary: expect.any(String) }),
      );
    });

    it('should resolve ticket and set resolvedAt timestamp', async () => {
      prisma.ticket.findFirst.mockResolvedValue(baseMockTicket);

      const resolvedTicket = {
        ...baseMockTicket,
        status: 'resolved',
        resolvedAt: new Date('2026-02-15'),
        application: { id: applicationId, name: 'Web App', platform: 'web', githubRepo: null },
        reporter: null,
        assignee: null,
      };
      prisma.ticket.update.mockResolvedValue(resolvedTicket);

      const result = await ticketsService.update('ticket-001', tenantId, {
        status: 'resolved' as unknown,
      });

      expect(result.status).toBe('resolved');
      expect(result.resolvedAt).toBeDefined();

      // Verify the update call included resolvedAt
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'resolved',
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should clear resolvedAt when reopening a ticket', async () => {
      const resolvedTicket = {
        ...baseMockTicket,
        status: 'resolved',
        resolvedAt: new Date(),
      };
      prisma.ticket.findFirst.mockResolvedValue(resolvedTicket);

      const reopenedTicket = {
        ...baseMockTicket,
        status: 'in_progress',
        resolvedAt: null,
        application: { id: applicationId, name: 'Web App', platform: 'web', githubRepo: null },
        reporter: null,
        assignee: null,
      };
      prisma.ticket.update.mockResolvedValue(reopenedTicket);

      const result = await ticketsService.update('ticket-001', tenantId, {
        status: 'in_progress' as unknown,
      });

      expect(result.status).toBe('in_progress');
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'in_progress',
            resolvedAt: null,
          }),
        }),
      );
    });

    it('should complete full lifecycle: create -> update -> assign -> resolve -> close', async () => {
      // Step 1: Create
      prisma.ticket.create.mockResolvedValue({
        ...baseMockTicket,
        reporter: null,
      });
      const created = await ticketsService.create(tenantId, {
        title: 'Lifecycle test',
        description: 'Full lifecycle',
        applicationId,
      });
      expect(created.status).toBe('new');

      // Step 2: Update with AI analysis
      prisma.ticket.findFirst.mockResolvedValue(baseMockTicket);
      prisma.ticket.update.mockResolvedValue({
        ...baseMockTicket,
        aiSummary: 'AI summary',
        severity: 'high',
        application: { ...baseMockTicket.application, githubRepo: null },
        reporter: null,
        assignee: null,
      });
      await ticketsService.update('ticket-001', tenantId, {
        aiSummary: 'AI summary',
        severity: 'high' as unknown,
      });

      // Step 3: Assign to user
      const assignee = { id: 'user-001', name: 'Dev', email: 'dev@test.com' };
      prisma.user.findFirst.mockResolvedValue({ ...assignee, tenantId });
      prisma.ticket.update.mockResolvedValue({
        ...baseMockTicket,
        assignedTo: 'user-001',
        assignee,
        application: { ...baseMockTicket.application, githubRepo: null },
        reporter: null,
      });
      prisma.ticket.findFirst.mockResolvedValue(baseMockTicket);
      const assigned = await ticketsService.assign('ticket-001', tenantId, 'user-001');
      expect(assigned.assignedTo).toBe('user-001');

      // Step 4: Resolve
      prisma.ticket.findFirst.mockResolvedValue({
        ...baseMockTicket,
        assignedTo: 'user-001',
      });
      prisma.ticket.update.mockResolvedValue({
        ...baseMockTicket,
        status: 'resolved',
        resolvedAt: new Date(),
        application: { ...baseMockTicket.application, githubRepo: null },
        reporter: null,
        assignee,
      });
      const resolved = await ticketsService.update('ticket-001', tenantId, {
        status: 'resolved' as unknown,
      });
      expect(resolved.status).toBe('resolved');

      // Step 5: Close (soft delete)
      prisma.ticket.findFirst.mockResolvedValue({
        ...baseMockTicket,
        status: 'resolved',
      });
      prisma.ticket.update.mockResolvedValue({
        ...baseMockTicket,
        status: 'closed',
        resolvedAt: new Date(),
      });
      const closed = await ticketsService.remove('ticket-001', tenantId);
      expect(closed.status).toBe('closed');

      // Verify WebSocket events were emitted at each step
      expect(mockGateway.emitTicketCreated).toHaveBeenCalledTimes(1);
      expect(mockGateway.emitTicketUpdated).toHaveBeenCalledTimes(2); // update + resolve
      expect(mockGateway.emitTicketAssigned).toHaveBeenCalledTimes(1); // assign
      expect(mockGateway.emitTicketDeleted).toHaveBeenCalledTimes(1);
    });
  });

  describe('ticket listing and pagination', () => {
    it('should paginate tickets with correct metadata', async () => {
      const tickets = Array.from({ length: 3 }, (_, i) => ({
        ...baseMockTicket,
        id: `ticket-${i + 1}`,
        title: `Ticket ${i + 1}`,
      }));

      prisma.ticket.findMany.mockResolvedValue(tickets);
      prisma.ticket.count.mockResolvedValue(25);

      const result = await ticketsService.findAll(tenantId, {
        page: 0,
        limit: 3,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown);

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(9); // ceil(25/3)
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should filter tickets by status', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await ticketsService.findAll(tenantId, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: 'resolved',
      } as unknown);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            status: 'resolved',
          }),
        }),
      );
    });

    it('should use cache for non-search queries', async () => {
      const cachedResult = {
        data: [baseMockTicket],
        pagination: { page: 0, limit: 20, total: 1, totalPages: 1, hasMore: false },
      };
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await ticketsService.findAll(tenantId, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown);

      expect(result).toEqual(cachedResult);
      // Prisma should not have been called
      expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    });

    it('should skip cache for search queries', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await ticketsService.findAll(tenantId, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'login',
      } as unknown);

      // Cache should not be checked for search queries
      // But Prisma should be called
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            OR: expect.arrayContaining([
              expect.objectContaining({
                title: { contains: 'login', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('multi-tenant isolation', () => {
    it('should not return tickets from other tenants', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.findOne('ticket-001', 'other-tenant-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should always include tenantId in query filters', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await ticketsService.findAll('tenant-002', {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-002',
          }),
        }),
      );
    });
  });
});
