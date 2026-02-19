import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TicketsService } from '@/modules/tickets/tickets.service';
import { TicketsGateway } from '@/modules/tickets/tickets.gateway';
import { CacheService } from '@/cache';
import { getQueueToken } from '@nestjs/bullmq';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { IntegrationsCryptoService } from '@/modules/integrations/integrations-crypto.service';
import { ConfigService } from '@nestjs/config';

/**
 * Multi-Tenant Isolation Integration Tests
 *
 * Tests that tenant A cannot access tenant B's data across all critical services.
 *
 * Scenarios covered:
 * - Ticket access/modification
 * - Integration access/modification
 * - List operations (should only return tenant's own data)
 * - Search operations
 */

// Mock the integration providers
jest.mock('@/modules/integrations/providers', () => {
  const mockProvider = {
    type: 'jira',
    name: 'Jira',
    description: 'Jira integration',
    requiredConfig: ['baseUrl', 'email', 'apiToken'],
    optionalConfig: [],
    supportsOAuth: false,
    validateConfig: jest.fn().mockResolvedValue({ valid: true }),
    testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
  };

  class MockJiraProvider {
    type = mockProvider.type;
    name = mockProvider.name;
    description = mockProvider.description;
    requiredConfig = mockProvider.requiredConfig;
    optionalConfig = mockProvider.optionalConfig;
    supportsOAuth = mockProvider.supportsOAuth;
    validateConfig = mockProvider.validateConfig;
    testConnection = mockProvider.testConnection;
  }

  return {
    INTEGRATION_PROVIDERS: {
      jira: MockJiraProvider,
    },
  };
});

describe('Multi-Tenant Isolation Integration', () => {
  let ticketsService: TicketsService;
  let integrationsService: IntegrationsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let mockGateway: Record<string, jest.Mock>;
  let mockCacheService: Record<string, jest.Mock>;
  let mockGithubQueue: { add: jest.Mock };

  const tenantA = 'tenant-a-001';
  const tenantB = 'tenant-b-001';
  const appA = 'app-a-001';
  const appB = 'app-b-001';

  const ticketA = {
    id: 'ticket-a-001',
    tenantId: tenantA,
    applicationId: appA,
    publicId: 'TENA123',
    title: 'Tenant A Bug',
    description: 'Tenant A description',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    application: { id: appA, name: 'App A', platform: 'web' },
    reporter: null,
    assignee: null,
    media: [],
    githubIssues: [],
    agentSessions: [],
  };

  const ticketB = {
    id: 'ticket-b-001',
    tenantId: tenantB,
    applicationId: appB,
    publicId: 'TENB456',
    title: 'Tenant B Bug',
    description: 'Tenant B description',
    status: 'new',
    type: 'bug',
    severity: 'high',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    application: { id: appB, name: 'App B', platform: 'web' },
    reporter: null,
    assignee: null,
    media: [],
    githubIssues: [],
    agentSessions: [],
  };

  const TEST_ENCRYPTION_KEY = 'a'.repeat(64);

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
      integration: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      integrationSyncLog: {
        findMany: jest.fn(),
        count: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        IntegrationsService,
        {
          provide: IntegrationsCryptoService,
          useFactory: () => {
            const configService = new ConfigService({
              INTEGRATION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            });
            return new IntegrationsCryptoService(configService);
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsGateway, useValue: mockGateway },
        { provide: CacheService, useValue: mockCacheService },
        { provide: getQueueToken('github'), useValue: mockGithubQueue },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
    integrationsService = module.get<IntegrationsService>(IntegrationsService);
  });

  describe('Ticket isolation', () => {
    it('should not allow tenant A to access tenant B ticket', async () => {
      // Tenant A tries to access tenant B's ticket
      prisma.ticket.findFirst.mockResolvedValue(null); // No ticket found with tenantA filter

      await expect(ticketsService.findOne('ticket-b-001', tenantA)).rejects.toThrow(
        NotFoundException,
      );

      // Verify Prisma query included tenantId filter
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ticket-b-001',
            tenantId: tenantA,
          }),
        }),
      );
    });

    it('should not allow tenant A to update tenant B ticket', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.update('ticket-b-001', tenantA, { title: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow tenant A to delete tenant B ticket', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.remove('ticket-b-001', tenantA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only return tenant A tickets in findAll', async () => {
      // Database returns only tenant A tickets (filtered by WHERE clause)
      prisma.ticket.findMany.mockResolvedValue([ticketA]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await ticketsService.findAll(tenantA, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tenantId).toBe(tenantA);

      // Verify query included tenant filter
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        }),
      );
    });

    it('should not mix tenant data in search results', async () => {
      // Search only returns tenant A results
      prisma.ticket.findMany.mockResolvedValue([ticketA]);
      prisma.ticket.count.mockResolvedValue(1);

      const result = await ticketsService.findAll(tenantA, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: 'bug',
      } as unknown);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tenantId).toBe(tenantA);

      // Verify tenant filter was applied
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: tenantA,
          }),
        }),
      );
    });

    it('should enforce tenant isolation across complete ticket lifecycle', async () => {
      // Tenant A creates a ticket
      prisma.ticket.create.mockResolvedValue({ ...ticketA, reporter: null });
      const created = await ticketsService.create(tenantA, {
        title: 'Tenant A Ticket',
        description: 'For tenant A only',
        applicationId: appA,
      });
      expect(created.tenantId).toBe(tenantA);

      // Tenant B tries to access it - should fail
      prisma.ticket.findFirst.mockResolvedValue(null);
      await expect(ticketsService.findOne(created.id, tenantB)).rejects.toThrow(
        NotFoundException,
      );

      // Tenant A can update it
      prisma.ticket.findFirst.mockResolvedValue(ticketA);
      prisma.ticket.update.mockResolvedValue({
        ...ticketA,
        title: 'Updated by A',
        application: { ...ticketA.application, githubRepo: null },
        reporter: null,
        assignee: null,
      });
      const updated = await ticketsService.update(created.id, tenantA, {
        title: 'Updated by A',
      });
      expect(updated.title).toBe('Updated by A');

      // Tenant B tries to update it - should fail
      prisma.ticket.findFirst.mockResolvedValue(null);
      await expect(
        ticketsService.update(created.id, tenantB, { title: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Integration isolation', () => {
    it('should not allow tenant A to access tenant B integration', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(integrationsService.findOne('int-b-001', tenantA)).rejects.toThrow(
        NotFoundException,
      );

      // Verify tenant filter was applied
      expect(prisma.integration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'int-b-001',
            tenantId: tenantA,
          }),
        }),
      );
    });

    it('should not allow tenant A to update tenant B integration', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(
        integrationsService.update('int-b-001', tenantA, { name: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow tenant A to delete tenant B integration', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(integrationsService.delete('int-b-001', tenantA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only return tenant A integrations in findAll', async () => {
      const integrationA = {
        id: 'int-a-001',
        tenantId: tenantA,
        type: 'jira',
        name: 'Tenant A Jira',
        enabled: true,
        config: 'encrypted',
        configIv: 'iv',
        _count: { syncLogs: 0 },
      };

      prisma.integration.findMany.mockResolvedValue([integrationA]);

      const result = await integrationsService.findAll(tenantA);

      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe(tenantA);

      // Verify tenant filter was applied
      expect(prisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        }),
      );
    });

    it('should not allow tenant A to test connection for tenant B integration', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(integrationsService.testConnection('int-b-001', tenantA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not allow tenant A to view tenant B sync logs', async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      await expect(integrationsService.getSyncLogs('int-b-001', tenantA, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Cross-tenant data leakage prevention', () => {
    it('should never expose tenant B data in tenant A API responses', async () => {
      // Simulate a database query that only returns tenant A data
      prisma.ticket.findMany.mockResolvedValue([ticketA]);
      prisma.ticket.count.mockResolvedValue(1);

      const ticketsResult = await ticketsService.findAll(tenantA, {
        page: 0,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown);

      // Verify no tenant B data leaked
      const hasTenantBData = ticketsResult.data.some((ticket: any) => ticket.tenantId === tenantB);
      expect(hasTenantBData).toBe(false);

      // All tickets should be from tenant A
      ticketsResult.data.forEach((ticket: any) => {
        expect(ticket.tenantId).toBe(tenantA);
      });
    });

    it('should maintain isolation when filtering by status', async () => {
      prisma.ticket.findMany.mockResolvedValue([ticketA]);
      prisma.ticket.count.mockResolvedValue(1);

      await ticketsService.findAll(tenantA, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: 'new',
      } as unknown);

      // Verify query included BOTH tenant and status filters
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: tenantA,
            status: 'new',
          }),
        }),
      );
    });

    it('should maintain isolation when filtering by severity', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await ticketsService.findAll(tenantA, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        severity: 'critical',
      } as unknown);

      // Verify tenant filter is always present
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: tenantA,
            severity: 'critical',
          }),
        }),
      );
    });

    it('should maintain isolation in integration sync logs', async () => {
      const integrationA = {
        id: 'int-a-001',
        tenantId: tenantA,
        type: 'jira',
        name: 'Tenant A Jira',
      };

      prisma.integration.findFirst.mockResolvedValue(integrationA);
      prisma.integrationSyncLog.findMany.mockResolvedValue([]);
      prisma.integrationSyncLog.count.mockResolvedValue(0);

      await integrationsService.getSyncLogs('int-a-001', tenantA, {});

      // Verify sync logs are filtered by integration (which is tenant-scoped)
      expect(prisma.integrationSyncLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            integrationId: 'int-a-001',
          }),
        }),
      );
    });
  });

  describe('Database-level tenant filtering', () => {
    it('should always include tenantId in WHERE clauses for findFirst', async () => {
      prisma.ticket.findFirst.mockResolvedValue(ticketA);

      await ticketsService.findOne('ticket-a-001', tenantA);

      // Verify tenantId is ALWAYS in the WHERE clause
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ticket-a-001',
            tenantId: tenantA,
          }),
        }),
      );
    });

    it('should always include tenantId in WHERE clauses for findMany', async () => {
      prisma.ticket.findMany.mockResolvedValue([ticketA]);
      prisma.ticket.count.mockResolvedValue(1);

      await ticketsService.findAll(tenantA, {
        page: 0,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      } as unknown);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: tenantA }),
        }),
      );
    });

    it('should always include tenantId in update operations', async () => {
      prisma.ticket.findFirst.mockResolvedValue(ticketA);
      prisma.ticket.update.mockResolvedValue({
        ...ticketA,
        title: 'Updated',
        application: { ...ticketA.application, githubRepo: null },
        reporter: null,
        assignee: null,
      });

      await ticketsService.update('ticket-a-001', tenantA, { title: 'Updated' });

      // The service calls findFirst with tenantId first, then update
      expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'ticket-a-001',
            tenantId: tenantA,
          }),
        }),
      );
    });
  });
});
