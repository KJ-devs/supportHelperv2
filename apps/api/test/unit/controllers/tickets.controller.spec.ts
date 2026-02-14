import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from '../../../src/modules/tickets/tickets.controller';
import { TicketsService } from '../../../src/modules/tickets/tickets.service';
import { TicketsSearchService } from '../../../src/modules/tickets/tickets-search.service';
import { TicketsAIService } from '../../../src/modules/tickets/tickets-ai.service';
import { IntegrationsSyncService } from '../../../src/modules/integrations/integrations-sync.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let ticketsService: jest.Mocked<TicketsService>;
  let ticketsSearchService: jest.Mocked<TicketsSearchService>;
  let ticketsAIService: jest.Mocked<TicketsAIService>;
  let integrationsSyncService: jest.Mocked<IntegrationsSyncService>;

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
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    application: {
      id: 'app-123',
      name: 'Test App',
      platform: 'web',
    },
    reporter: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  const mockPaginatedResponse = {
    data: [mockTicket],
    pagination: {
      page: 0,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasMore: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            assign: jest.fn(),
            getStats: jest.fn(),
          },
        },
        {
          provide: TicketsSearchService,
          useValue: {
            isEnabled: jest.fn(),
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
          provide: IntegrationsSyncService,
          useValue: {
            syncTicketToAllEnabledIntegrations: jest.fn(),
            deleteTicketFromAllIntegrations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    ticketsService = module.get(TicketsService);
    ticketsSearchService = module.get(TicketsSearchService);
    ticketsAIService = module.get(TicketsAIService);
    integrationsSyncService = module.get(IntegrationsSyncService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a ticket and trigger analysis and sync', async () => {
      const dto = {
        title: 'Test Ticket',
        description: 'Test description',
        applicationId: 'app-123',
        userContext: {},
        reproductionSteps: [],
      };

      (ticketsService.create as jest.Mock).mockResolvedValue(mockTicket);
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(true);
      (ticketsSearchService.indexTicket as jest.Mock).mockResolvedValue(undefined);
      (ticketsAIService.enqueueAnalysis as jest.Mock).mockResolvedValue(undefined);
      (integrationsSyncService.syncTicketToAllEnabledIntegrations as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.create('tenant-123', 'user-123', dto as any);

      expect(ticketsService.create).toHaveBeenCalledWith('tenant-123', dto, 'user-123');
      expect(ticketsSearchService.isEnabled).toHaveBeenCalled();
      expect(ticketsSearchService.indexTicket).toHaveBeenCalledWith(mockTicket);
      expect(ticketsAIService.enqueueAnalysis).toHaveBeenCalledWith('ticket-123');
      expect(integrationsSyncService.syncTicketToAllEnabledIntegrations).toHaveBeenCalledWith(
        'ticket-123',
        'tenant-123',
        { priority: 2 },
      );
      expect(result).toEqual(mockTicket);
    });

    it('should skip indexing when search is disabled', async () => {
      const dto = {
        title: 'Test Ticket',
        description: 'Test description',
        applicationId: 'app-123',
      };

      (ticketsService.create as jest.Mock).mockResolvedValue(mockTicket);
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(false);
      (ticketsAIService.enqueueAnalysis as jest.Mock).mockResolvedValue(undefined);
      (integrationsSyncService.syncTicketToAllEnabledIntegrations as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.create('tenant-123', 'user-123', dto as any);

      expect(ticketsSearchService.indexTicket).not.toHaveBeenCalled();
      expect(ticketsAIService.enqueueAnalysis).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all tickets with filters', async () => {
      (ticketsService.findAll as jest.Mock).mockResolvedValue(mockPaginatedResponse);

      const filters = {
        page: 0,
        limit: 20,
        status: 'open',
      };

      const result = await controller.findAll('tenant-123', filters as any);

      expect(ticketsService.findAll).toHaveBeenCalledWith('tenant-123', filters);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should handle empty filters', async () => {
      (ticketsService.findAll as jest.Mock).mockResolvedValue(mockPaginatedResponse);

      await controller.findAll('tenant-123', {} as any);

      expect(ticketsService.findAll).toHaveBeenCalledWith('tenant-123', {});
    });
  });

  describe('getStats', () => {
    it('should return ticket statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: { open: 40, in_progress: 30, resolved: 20, closed: 10 },
        bySeverity: { low: 30, medium: 50, high: 15, critical: 5 },
        byType: { bug: 60, feature: 25, question: 15 },
        recentTickets: 15,
        avgResolutionTimeHours: 24,
      };

      (ticketsService.getStats as jest.Mock).mockResolvedValue(mockStats);

      const result = await controller.getStats('tenant-123');

      expect(ticketsService.getStats).toHaveBeenCalledWith('tenant-123');
      expect(result).toEqual(mockStats);
    });
  });

  describe('search', () => {
    it('should search tickets using search service', async () => {
      const searchDto = {
        query: 'login error',
        limit: 10,
      };

      const mockSearchResults = {
        hits: [mockTicket],
        estimatedTotalHits: 1,
        processingTimeMs: 5,
      };

      (ticketsSearchService.search as jest.Mock).mockResolvedValue(mockSearchResults);

      const result = await controller.search('tenant-123', searchDto as any);

      expect(ticketsSearchService.search).toHaveBeenCalledWith('tenant-123', searchDto);
      expect(result).toEqual(mockSearchResults);
    });
  });

  describe('findOne', () => {
    it('should return a single ticket', async () => {
      (ticketsService.findOne as jest.Mock).mockResolvedValue(mockTicket);

      const result = await controller.findOne('tenant-123', 'ticket-123');

      expect(ticketsService.findOne).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(result).toEqual(mockTicket);
    });
  });

  describe('findSimilar', () => {
    it('should find similar tickets with default limit', async () => {
      const similarTickets = [mockTicket];
      (ticketsAIService.findSimilar as jest.Mock).mockResolvedValue(similarTickets);

      const result = await controller.findSimilar('tenant-123', 'ticket-123', 5);

      expect(ticketsAIService.findSimilar).toHaveBeenCalledWith('ticket-123', 'tenant-123', 5);
      expect(result).toEqual(similarTickets);
    });

    it('should find similar tickets with custom limit', async () => {
      const similarTickets = [mockTicket];
      (ticketsAIService.findSimilar as jest.Mock).mockResolvedValue(similarTickets);

      await controller.findSimilar('tenant-123', 'ticket-123', 10);

      expect(ticketsAIService.findSimilar).toHaveBeenCalledWith('ticket-123', 'tenant-123', 10);
    });
  });

  describe('update', () => {
    it('should update a ticket and sync to integrations', async () => {
      const dto = {
        title: 'Updated Title',
        status: 'in_progress',
      };

      const updatedTicket = { ...mockTicket, ...dto };

      (ticketsService.update as jest.Mock).mockResolvedValue(updatedTicket);
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(true);
      (ticketsSearchService.updateTicket as jest.Mock).mockResolvedValue(undefined);
      (integrationsSyncService.syncTicketToAllEnabledIntegrations as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.update('tenant-123', 'ticket-123', dto as any);

      expect(ticketsService.update).toHaveBeenCalledWith('ticket-123', 'tenant-123', dto);
      expect(ticketsSearchService.updateTicket).toHaveBeenCalledWith(updatedTicket);
      expect(integrationsSyncService.syncTicketToAllEnabledIntegrations).toHaveBeenCalledWith(
        'ticket-123',
        'tenant-123',
        { action: 'update' },
      );
      expect(result).toEqual(updatedTicket);
    });

    it('should skip search update when search is disabled', async () => {
      const dto = { title: 'Updated Title' };

      (ticketsService.update as jest.Mock).mockResolvedValue(mockTicket);
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(false);
      (integrationsSyncService.syncTicketToAllEnabledIntegrations as jest.Mock).mockResolvedValue(
        undefined,
      );

      await controller.update('tenant-123', 'ticket-123', dto as any);

      expect(ticketsSearchService.updateTicket).not.toHaveBeenCalled();
      expect(integrationsSyncService.syncTicketToAllEnabledIntegrations).toHaveBeenCalled();
    });
  });

  describe('assign', () => {
    it('should assign ticket to user', async () => {
      const assignDto = { userId: 'user-456' };
      const assignedTicket = {
        ...mockTicket,
        assignedTo: 'user-456',
        assignee: {
          id: 'user-456',
          name: 'Assigned User',
          email: 'assigned@example.com',
        },
      };

      (ticketsService.assign as jest.Mock).mockResolvedValue(assignedTicket);

      const result = await controller.assign('tenant-123', 'ticket-123', assignDto as any);

      expect(ticketsService.assign).toHaveBeenCalledWith('ticket-123', 'tenant-123', 'user-456');
      expect(result).toEqual(assignedTicket);
    });

    it('should unassign ticket when userId is null', async () => {
      const assignDto = { userId: null };

      (ticketsService.assign as jest.Mock).mockResolvedValue({
        ...mockTicket,
        assignedTo: null,
        assignee: null,
      });

      const result = await controller.assign('tenant-123', 'ticket-123', assignDto as any);

      expect(ticketsService.assign).toHaveBeenCalledWith('ticket-123', 'tenant-123', null);
      expect(result.assignedTo).toBeNull();
    });
  });

  describe('remove', () => {
    it('should delete ticket and sync to integrations', async () => {
      const deletedTicket = { ...mockTicket, status: 'closed' };

      (integrationsSyncService.deleteTicketFromAllIntegrations as jest.Mock).mockResolvedValue(
        undefined,
      );
      (ticketsService.remove as jest.Mock).mockResolvedValue(deletedTicket);
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(true);
      (ticketsSearchService.removeTicket as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.remove('tenant-123', 'ticket-123');

      expect(integrationsSyncService.deleteTicketFromAllIntegrations).toHaveBeenCalledWith(
        'ticket-123',
        'tenant-123',
      );
      expect(ticketsService.remove).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(ticketsSearchService.removeTicket).toHaveBeenCalledWith('ticket-123');
      expect(result).toEqual(deletedTicket);
    });

    it('should skip search removal when search is disabled', async () => {
      (integrationsSyncService.deleteTicketFromAllIntegrations as jest.Mock).mockResolvedValue(
        undefined,
      );
      (ticketsService.remove as jest.Mock).mockResolvedValue(mockTicket);
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(false);

      await controller.remove('tenant-123', 'ticket-123');

      expect(ticketsSearchService.removeTicket).not.toHaveBeenCalled();
      expect(integrationsSyncService.deleteTicketFromAllIntegrations).toHaveBeenCalled();
    });

    it('should sync deletions before removing the ticket', async () => {
      const callOrder: string[] = [];

      (integrationsSyncService.deleteTicketFromAllIntegrations as jest.Mock).mockImplementation(
        async () => {
          callOrder.push('sync');
        },
      );
      (ticketsService.remove as jest.Mock).mockImplementation(async () => {
        callOrder.push('remove');
        return mockTicket;
      });
      (ticketsSearchService.isEnabled as jest.Mock).mockReturnValue(false);

      await controller.remove('tenant-123', 'ticket-123');

      expect(callOrder).toEqual(['sync', 'remove']);
    });
  });
});
