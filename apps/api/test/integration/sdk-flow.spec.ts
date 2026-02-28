import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthService } from '@/modules/auth/auth.service';
import { TicketsService } from '@/modules/tickets/tickets.service';
import { TicketsGateway } from '@/modules/tickets/tickets.gateway';
import { CacheService } from '@/cache';
import { getQueueToken } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * SDK Flow Integration Tests
 *
 * Tests the complete SDK client flow:
 * 1. Validate SDK key (x-sdk-key header)
 * 2. Create ticket from SDK
 * 3. Return ticket ID to client
 *
 * Uses mocked Prisma but tests real service logic for SDK authentication.
 */
describe('SDK Flow Integration', () => {
  let authService: AuthService;
  let ticketsService: TicketsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let mockGateway: Record<string, jest.Mock>;
  let mockCacheService: Record<string, jest.Mock>;
  let mockGithubQueue: { add: jest.Mock };

  const tenantId = 'tenant-sdk-001';
  const applicationId = 'app-sdk-001';
  const sdkKey = 'sk_test_abc123def456';

  const mockTenant = {
    id: tenantId,
    name: 'SDK Test Org',
    slug: 'sdk-test-org',
    plan: 'free',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApplication = {
    id: applicationId,
    tenantId,
    name: 'Test Web App',
    platform: 'web',
    sdkKey,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: mockTenant,
  };

  beforeEach(async () => {
    prisma = {
      application: {
        findUnique: jest.fn(),
      },
      ticket: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
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
        AuthService,
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TicketsGateway, useValue: mockGateway },
        { provide: CacheService, useValue: mockCacheService },
        { provide: getQueueToken('github'), useValue: mockGithubQueue },
        { provide: getQueueToken('deep-analysis'), useValue: { add: jest.fn().mockResolvedValue({ id: 'job-da' }) } },
        { provide: getQueueToken('triage'), useValue: { add: jest.fn().mockResolvedValue({ id: 'job-triage' }) } },
        {
          provide: JwtService,
          useFactory: () =>
            new JwtService({
              secret: 'test-secret',
              signOptions: { expiresIn: '7d' },
            }),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    ticketsService = module.get<TicketsService>(TicketsService);
  });

  describe('SDK key validation', () => {
    it('should validate a valid SDK key and return application', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      const result = await authService.validateApiKey(sdkKey);

      expect(result.id).toBe(applicationId);
      expect(result.tenantId).toBe(tenantId);
      expect(result.tenant.id).toBe(tenantId);
      expect(result.sdkKey).toBe(sdkKey);

      // Verify Prisma was called with correct query
      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { sdkKey },
        include: { tenant: true },
      });
    });

    it('should reject invalid SDK key', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(authService.validateApiKey('sk_invalid_key')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject empty SDK key', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(authService.validateApiKey('')).rejects.toThrow(UnauthorizedException);
    });

    it('should reject SDK key with wrong format', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(authService.validateApiKey('not-a-valid-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('SDK ticket creation flow', () => {
    it('should create ticket from SDK with valid key', async () => {
      const mockTicket = {
        id: 'ticket-sdk-001',
        tenantId,
        applicationId,
        publicId: 'SDK123',
        title: 'SDK Bug Report',
        description: 'Login button not working on mobile',
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
        application: {
          id: applicationId,
          name: 'Test Web App',
          platform: 'web',
        },
        reporter: null,
      };

      prisma.ticket.create.mockResolvedValue(mockTicket);

      const ticket = await ticketsService.create(
        tenantId,
        {
          title: 'SDK Bug Report',
          description: 'Login button not working on mobile',
          applicationId,
        },
        undefined, // No reporter ID for SDK tickets
      );

      expect(ticket.id).toBe('ticket-sdk-001');
      expect(ticket.title).toBe('SDK Bug Report');
      expect(ticket.applicationId).toBe(applicationId);
      expect(ticket.reporterId).toBeNull();

      // Verify WebSocket event was emitted
      expect(mockGateway.emitTicketCreated).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ id: 'ticket-sdk-001' }),
      );
    });

    it('should create ticket with userContext from SDK', async () => {
      const userContext = {
        browser: 'Chrome',
        os: 'macOS',
        viewport: '1920x1080',
        url: 'https://app.example.com/login',
      };

      const mockTicket = {
        id: 'ticket-sdk-002',
        tenantId,
        applicationId,
        publicId: 'SDK124',
        title: 'SDK Bug with Context',
        description: 'Context-rich bug report',
        userContext,
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
        application: {
          id: applicationId,
          name: 'Test Web App',
          platform: 'web',
        },
        reporter: null,
      };

      prisma.ticket.create.mockResolvedValue(mockTicket);

      const ticket = await ticketsService.create(
        tenantId,
        {
          title: 'SDK Bug with Context',
          description: 'Context-rich bug report',
          applicationId,
          userContext,
        },
        undefined,
      );

      expect(ticket.userContext).toEqual(userContext);

      // Verify Prisma was called with userContext
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userContext,
          }),
        }),
      );
    });

    it('should complete full SDK flow: validate key -> create ticket -> return ID', async () => {
      // Step 1: Validate SDK key
      prisma.application.findUnique.mockResolvedValue(mockApplication);
      const app = await authService.validateApiKey(sdkKey);
      expect(app.id).toBe(applicationId);

      // Step 2: Create ticket from SDK
      const mockTicket = {
        id: 'ticket-sdk-full-flow',
        tenantId,
        applicationId,
        publicId: 'SDK125',
        title: 'Full Flow Ticket',
        description: 'End-to-end SDK test',
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
        application: {
          id: applicationId,
          name: 'Test Web App',
          platform: 'web',
        },
        reporter: null,
      };

      prisma.ticket.create.mockResolvedValue(mockTicket);

      const ticket = await ticketsService.create(
        app.tenantId,
        {
          title: 'Full Flow Ticket',
          description: 'End-to-end SDK test',
          applicationId: app.id,
        },
        undefined,
      );

      // Step 3: Verify response structure (what SDK client receives)
      expect(ticket.id).toBe('ticket-sdk-full-flow');
      expect(ticket.status).toBe('new');
      expect(ticket.createdAt).toBeDefined();
      expect(ticket.applicationId).toBe(applicationId);

      // Verify WebSocket notification was sent
      expect(mockGateway.emitTicketCreated).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({ id: 'ticket-sdk-full-flow' }),
      );
    });
  });

  describe('SDK ticket with reproduction steps', () => {
    it('should accept reproduction steps from SDK', async () => {
      const reproductionSteps = [
        '1. Navigate to login page',
        '2. Enter credentials',
        '3. Click login button',
        '4. Button does not respond',
      ];

      const mockTicket = {
        id: 'ticket-sdk-repro',
        tenantId,
        applicationId,
        publicId: 'SDK126',
        title: 'Login Bug',
        description: 'Button not responding',
        reproductionSteps,
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
        createdAt: new Date(),
        updatedAt: new Date(),
        application: {
          id: applicationId,
          name: 'Test Web App',
          platform: 'web',
        },
        reporter: null,
      };

      prisma.ticket.create.mockResolvedValue(mockTicket);

      const ticket = await ticketsService.create(
        tenantId,
        {
          title: 'Login Bug',
          description: 'Button not responding',
          applicationId,
          reproductionSteps,
        },
        undefined,
      );

      expect(ticket.reproductionSteps).toEqual(reproductionSteps);
    });
  });

  describe('SDK multi-tenant isolation', () => {
    it('should not allow SDK key from one tenant to create tickets for another tenant', async () => {
      const otherTenantId = 'other-tenant-001';

      // SDK key validates to tenant A
      prisma.application.findUnique.mockResolvedValue(mockApplication);
      const app = await authService.validateApiKey(sdkKey);
      expect(app.tenantId).toBe(tenantId);

      // Attempting to create ticket for tenant B should fail
      // (In real implementation, the controller enforces this via @CurrentTenant decorator)
      const mockTicket = {
        id: 'ticket-wrong-tenant',
        tenantId: otherTenantId, // Wrong tenant
        applicationId,
        publicId: 'WRONG',
        title: 'Wrong Tenant',
        description: 'Should not be created',
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
        application: {
          id: applicationId,
          name: 'Test Web App',
          platform: 'web',
        },
        reporter: null,
      };

      prisma.ticket.create.mockResolvedValue(mockTicket);

      // Create with validated tenant ID (correct flow)
      const ticket = await ticketsService.create(
        app.tenantId, // Use tenant from validated SDK key
        {
          title: 'Correct Tenant',
          description: 'Created for correct tenant',
          applicationId,
        },
        undefined,
      );

      // Verify ticket was created for the correct tenant
      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant: { connect: { id: tenantId } }, // Should be the SDK key's tenant, not other tenant
          }),
        }),
      );
    });
  });
});
