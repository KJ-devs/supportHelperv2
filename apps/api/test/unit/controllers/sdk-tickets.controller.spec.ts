import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SdkTicketsController } from '../../../src/modules/tickets/sdk-tickets.controller';
import { TicketsService } from '../../../src/modules/tickets/tickets.service';
import { TicketsSearchService } from '../../../src/modules/tickets/tickets-search.service';
import { TicketsAIService } from '../../../src/modules/tickets/tickets-ai.service';
import { AIService } from '../../../src/ai/ai.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { IntegrationsSyncService } from '../../../src/modules/integrations/integrations-sync.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
}));

describe('SdkTicketsController', () => {
  let controller: SdkTicketsController;
  let ticketsService: jest.Mocked<TicketsService>;
  let searchService: jest.Mocked<TicketsSearchService>;
  let aiService: jest.Mocked<TicketsAIService>;
  let aiProcessingService: jest.Mocked<AIService>;
  let integrationsSyncService: jest.Mocked<IntegrationsSyncService>;
  let prisma: any;

  const mockTenantId = 'tenant-123';
  const mockApplicationId = 'app-123';

  const mockTicket = {
    id: 'ticket-001',
    tenantId: mockTenantId,
    applicationId: mockApplicationId,
    title: 'Bug Report from SDK',
    description: 'Something is broken',
    status: 'new',
    type: 'bug',
    severity: 'medium',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockAiResult = {
    summary: 'User reports login failure',
    enrichedDescription: 'The user is experiencing a login failure when clicking the submit button.',
    severity: 'high',
    severityConfidence: 0.85,
    type: 'bug',
    typeConfidence: 0.92,
    keywords: ['login', 'failure', 'button'],
    reproductionSteps: ['Navigate to login page', 'Enter credentials', 'Click submit'],
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        's3.endpoint': 'http://localhost:9000',
        's3.accessKeyId': 'minioadmin',
        's3.secretAccessKey': 'minioadmin',
        's3.bucket': 'test-bucket',
        's3.region': 'us-east-1',
        'S3_ENDPOINT': undefined,
        'S3_ACCESS_KEY': undefined,
        'S3_SECRET_KEY': undefined,
        'S3_BUCKET': undefined,
        'S3_REGION': undefined,
      };
      return config[key];
    }),
  };

  const mockTicketsService = {
    create: jest.fn().mockResolvedValue(mockTicket),
    update: jest.fn().mockResolvedValue(mockTicket),
    findOne: jest.fn().mockResolvedValue(mockTicket),
  };

  const mockSearchService = {
    isEnabled: jest.fn().mockReturnValue(false),
    indexTicket: jest.fn().mockResolvedValue(undefined),
  };

  const mockAIService = {
    enqueueAnalysis: jest.fn().mockResolvedValue(undefined),
    updateKeywords: jest.fn().mockResolvedValue(undefined),
  };

  const mockAIProcessingService = {
    processUserDescription: jest.fn().mockResolvedValue(mockAiResult),
  };

  const mockIntegrationsSyncService = {
    syncTicketToAllEnabledIntegrations: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    media: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SdkTicketsController],
      providers: [
        { provide: TicketsService, useValue: mockTicketsService },
        { provide: TicketsSearchService, useValue: mockSearchService },
        { provide: TicketsAIService, useValue: mockAIService },
        { provide: AIService, useValue: mockAIProcessingService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: IntegrationsSyncService, useValue: mockIntegrationsSyncService },
      ],
    }).compile();

    controller = module.get<SdkTicketsController>(SdkTicketsController);
    ticketsService = module.get(TicketsService);
    searchService = module.get(TicketsSearchService);
    aiService = module.get(TicketsAIService);
    aiProcessingService = module.get(AIService);
    integrationsSyncService = module.get(IntegrationsSyncService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      title: 'Login broken',
      description: 'Cannot log in',
      applicationId: mockApplicationId,
    };

    it('should create a ticket and return success response', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      const result = await controller.create(mockTenantId, createDto);

      expect(result).toEqual({
        success: true,
        ticket: {
          id: mockTicket.id,
          title: mockTicket.title,
          status: mockTicket.status,
          createdAt: mockTicket.createdAt,
        },
      });
    });

    it('should call ticketsService.create with tenantId and no reporter', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.create(mockTenantId, createDto);

      expect(ticketsService.create).toHaveBeenCalledWith(
        mockTenantId,
        createDto,
        undefined,
      );
    });

    it('should enqueue AI analysis with priority 3', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.create(mockTenantId, createDto);

      expect(aiService.enqueueAnalysis).toHaveBeenCalledWith(mockTicket.id, 3);
    });

    it('should trigger integration sync', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.create(mockTenantId, createDto);

      expect(integrationsSyncService.syncTicketToAllEnabledIntegrations).toHaveBeenCalledWith(
        mockTicket.id,
        mockTenantId,
        { priority: 2 },
      );
    });

    it('should index in Meilisearch when enabled', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);
      mockSearchService.isEnabled.mockReturnValue(true);

      await controller.create(mockTenantId, createDto);

      expect(searchService.indexTicket).toHaveBeenCalledWith(mockTicket);
    });

    it('should not index in Meilisearch when disabled', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);
      mockSearchService.isEnabled.mockReturnValue(false);

      await controller.create(mockTenantId, createDto);

      expect(searchService.indexTicket).not.toHaveBeenCalled();
    });
  });

  describe('report', () => {
    const mockRequest = {
      sdk: { applicationId: mockApplicationId },
    } as any;

    const mockBody = {
      title: 'Bug found',
      description: 'Something is wrong with the login page',
      userContext: JSON.stringify({ os: 'Windows', browser: 'Chrome' }),
    };

    it('should process report and return AI analysis', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      const result = await controller.report(
        mockRequest,
        mockTenantId,
        undefined,
        mockBody,
      );

      expect(result.success).toBe(true);
      expect(result.ticket).toBeDefined();
      expect(result.ticket.id).toBe(mockTicket.id);
      expect(result.aiAnalysis).toBeDefined();
      expect(result.aiAnalysis.summary).toBe(mockAiResult.summary);
      expect(result.video).toEqual({ received: false });
    });

    it('should call AI service to process description', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, mockBody);

      expect(aiProcessingService.processUserDescription).toHaveBeenCalledWith(
        mockBody.description,
        { os: 'Windows', browser: 'Chrome' },
      );
    });

    it('should use default title when not provided', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, {
        description: 'A bug',
      });

      expect(ticketsService.create).toHaveBeenCalledWith(
        mockTenantId,
        expect.objectContaining({ title: 'Bug Report from SDK' }),
        undefined,
      );
    });

    it('should use empty description when not provided', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, {});

      expect(aiProcessingService.processUserDescription).toHaveBeenCalledWith(
        '',
        undefined,
      );
    });

    it('should handle malformed userContext JSON gracefully', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, {
        description: 'test',
        userContext: 'not-valid-json{{{',
      });

      expect(aiProcessingService.processUserDescription).toHaveBeenCalledWith(
        'test',
        { raw: 'not-valid-json{{{' },
      );
    });

    it('should throw InternalServerErrorException when applicationId is missing from sdk', async () => {
      const reqWithoutAppId = { sdk: {} } as any;

      await expect(
        controller.report(reqWithoutAppId, mockTenantId, undefined, mockBody),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when sdk is undefined on request', async () => {
      const reqWithoutSdk = {} as any;

      await expect(
        controller.report(reqWithoutSdk, mockTenantId, undefined, mockBody),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should update ticket with AI analysis fields', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, mockBody);

      expect(ticketsService.update).toHaveBeenCalledWith(
        mockTicket.id,
        mockTenantId,
        expect.objectContaining({
          aiSummary: mockAiResult.summary,
          type: 'bug',
          severity: 'high',
        }),
      );
    });

    it('should update keywords when AI returns them', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, mockBody);

      expect(aiService.updateKeywords).toHaveBeenCalledWith(
        mockTicket.id,
        mockAiResult.keywords,
      );
    });

    it('should handle video upload when provided', async () => {
      mockTicketsService.create.mockResolvedValue(mockTicket as any);
      mockPrismaService.media.create.mockResolvedValue({
        id: 'media-001',
        storageKey: `${mockTenantId}/${mockTicket.id}/video-123.webm`,
      });

      const mockVideo: Express.Multer.File = {
        fieldname: 'video',
        originalname: 'screen-recording.webm',
        encoding: '7bit',
        mimetype: 'video/webm',
        buffer: Buffer.from('fake-video-data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await controller.report(
        mockRequest,
        mockTenantId,
        mockVideo,
        mockBody,
      );

      expect(result.video.received).toBe(true);
      expect(result.video).toHaveProperty('mediaId', 'media-001');
      expect(prisma.media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: mockTicket.id,
            type: 'video',
            mimeType: 'video/webm',
            processingStatus: 'completed',
          }),
        }),
      );
    });

    it('should map AI crash type to bug', async () => {
      const resultWithCrash = { ...mockAiResult, type: 'crash' };
      mockAIProcessingService.processUserDescription.mockResolvedValue(resultWithCrash);
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, mockBody);

      expect(ticketsService.update).toHaveBeenCalledWith(
        mockTicket.id,
        mockTenantId,
        expect.objectContaining({ type: 'bug' }),
      );
    });

    it('should map AI feature-request type to feature_request', async () => {
      const resultWithFeature = { ...mockAiResult, type: 'feature-request' };
      mockAIProcessingService.processUserDescription.mockResolvedValue(resultWithFeature);
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, mockBody);

      expect(ticketsService.update).toHaveBeenCalledWith(
        mockTicket.id,
        mockTenantId,
        expect.objectContaining({ type: 'feature_request' }),
      );
    });

    it('should default unknown severity to medium', async () => {
      const resultWithUnknownSeverity = { ...mockAiResult, severity: 'unknown' };
      mockAIProcessingService.processUserDescription.mockResolvedValue(resultWithUnknownSeverity);
      mockTicketsService.create.mockResolvedValue(mockTicket as any);

      await controller.report(mockRequest, mockTenantId, undefined, mockBody);

      expect(ticketsService.update).toHaveBeenCalledWith(
        mockTicket.id,
        mockTenantId,
        expect.objectContaining({ severity: 'medium' }),
      );
    });
  });
});
