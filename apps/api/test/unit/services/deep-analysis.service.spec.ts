jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeepAnalysisService } from '../../../src/modules/agent-v2/deep-analysis.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CodeInvestigationService } from '../../../src/modules/agent-v2/code-investigation.service';
import { AgenticLoopService } from '../../../src/modules/agent-v2/agentic-loop.service';
import { DiagnosisService, Diagnosis } from '../../../src/modules/agent-v2/diagnosis.service';
import type { Octokit } from '@octokit/rest';

describe('DeepAnalysisService', () => {
  let service: DeepAnalysisService;
  let prisma: jest.Mocked<PrismaService>;
  let codeInvestigation: jest.Mocked<CodeInvestigationService>;
  let agenticLoop: jest.Mocked<AgenticLoopService>;
  let diagnosisService: jest.Mocked<DiagnosisService>;

  const mockRepoCtx = {
    octokit: {} as Octokit,
    owner: 'acme',
    repo: 'my-app',
    defaultBranch: 'main',
    installationId: '12345',
    tenantId: 'tenant-123',
    applicationId: 'app-123',
  };

  const mockTicketBase = {
    id: 'ticket-123',
    tenantId: 'tenant-123',
    applicationId: 'app-123',
    title: 'Login button crashes',
    description: 'When clicking the login button the app freezes',
    aiSummary: 'UI freeze on login',
    type: 'bug',
    typeConfidence: 0.9,
    severity: 'high',
    keywords: ['login', 'crash', 'freeze'],
    status: 'open',
    media: [],
  };

  const mockLoopResult = {
    finalContent: 'Root cause found in auth.service.ts',
    toolCallLog: [
      {
        toolCallId: 'tool-1',
        name: 'read_file' as const,
        input: { file_path: 'src/auth.ts' },
        result: 'content',
        durationMs: 100,
      },
    ],
    iterations: 3,
    messages: [],
  };

  const mockDiagnosis: Diagnosis = {
    rootCause: 'Null pointer in auth service',
    affectedFiles: [{ filePath: 'src/auth.ts', relevance: 'primary', description: 'Main auth' }],
    confidence: 0.85,
  };

  beforeEach(async () => {
    const mockPrisma = {
      ticket: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      ticketEvent: {
        create: jest.fn(),
      },
      agentSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      agentMessage: {
        create: jest.fn(),
      },
    };

    const mockCodeInvestigation = {
      getRepoContext: jest.fn(),
      getRepoStructure: jest.fn(),
    };

    const mockAgenticLoop = {
      run: jest.fn(),
    };

    const mockDiagnosisService = {
      extractDiagnosisFromToolCalls: jest.fn(),
      saveDiagnosis: jest.fn(),
      getDiagnosis: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeepAnalysisService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CodeInvestigationService, useValue: mockCodeInvestigation },
        { provide: AgenticLoopService, useValue: mockAgenticLoop },
        { provide: DiagnosisService, useValue: mockDiagnosisService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<DeepAnalysisService>(DeepAnalysisService);
    prisma = module.get(PrismaService);
    codeInvestigation = module.get(CodeInvestigationService);
    agenticLoop = module.get(AgenticLoopService);
    diagnosisService = module.get(DiagnosisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyze', () => {
    beforeEach(() => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicketBase);
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.ticketEvent.create as jest.Mock).mockResolvedValue({});
      (agenticLoop.run as jest.Mock).mockResolvedValue(mockLoopResult);
      (diagnosisService.extractDiagnosisFromToolCalls as jest.Mock).mockReturnValue(mockDiagnosis);
      (diagnosisService.saveDiagnosis as jest.Mock).mockResolvedValue(undefined);
    });

    it('throws NotFoundException when ticket does not exist', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.analyze('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
      await expect(service.analyze('missing', 'tenant-123')).rejects.toThrow('Ticket missing not found');
    });

    it('runs basic analysis when no GitHub repo connected', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);

      const result = await service.analyze('ticket-123', 'tenant-123');

      expect(codeInvestigation.getRepoContext).toHaveBeenCalledWith('app-123');
      expect(agenticLoop.run).toHaveBeenCalledWith(
        expect.objectContaining({
          repoCtx: null,
          systemPrompt: expect.stringContaining('No repository connected'),
        }),
      );
      expect(result).toEqual(mockDiagnosis);
    });

    it('sets ticket status to analyzing at start', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);

      await service.analyze('ticket-123', 'tenant-123');

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-123' },
          data: { status: 'analyzing' },
        }),
      );
    });

    it('sets ticket status to analyzed on success', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);

      await service.analyze('ticket-123', 'tenant-123');

      const updateCalls = (prisma.ticket.update as jest.Mock).mock.calls;
      const analyzedCall = updateCalls.find(
        (call) => call[0].data?.status === 'analyzed',
      );
      expect(analyzedCall).toBeDefined();
    });

    it('sets ticket status to analysis_failed on error', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);
      (agenticLoop.run as jest.Mock).mockRejectedValue(new Error('AI service unavailable'));

      await expect(service.analyze('ticket-123', 'tenant-123')).rejects.toThrow(
        'AI service unavailable',
      );

      const updateCalls = (prisma.ticket.update as jest.Mock).mock.calls;
      const failedCall = updateCalls.find(
        (call) => call[0].data?.status === 'analysis_failed',
      );
      expect(failedCall).toBeDefined();
    });

    it('creates TicketEvent analysis_completed on success', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);

      await service.analyze('ticket-123', 'tenant-123');

      expect(prisma.ticketEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: 'ticket-123',
            eventType: 'analysis_completed',
          }),
        }),
      );
    });

    it('creates TicketEvent analysis_failed on error', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);
      (agenticLoop.run as jest.Mock).mockRejectedValue(new Error('Timeout'));

      await expect(service.analyze('ticket-123', 'tenant-123')).rejects.toThrow();

      expect(prisma.ticketEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'analysis_failed',
          }),
        }),
      );
    });

    it('builds system prompt with video OCR when media present', async () => {
      const ticketWithMedia = {
        ...mockTicketBase,
        media: [
          {
            metadata: null,
            videoEvents: [
              { timestampMs: 1000, ocrText: 'Error: Cannot read property of null' },
              { timestampMs: 2000, ocrText: 'TypeError at line 42' },
            ],
          },
        ],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithMedia);
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('Video Analysis (OCR extracted text)');
      expect(loopOptions.systemPrompt).toContain('Error: Cannot read property of null');
      expect(loopOptions.systemPrompt).toContain('TypeError at line 42');
    });

    it('builds system prompt with visual cues when visualCues present in metadata', async () => {
      const ticketWithVisualCues = {
        ...mockTicketBase,
        media: [
          {
            metadata: {
              visualCues: {
                errors: ['NullPointerException'],
                urls: ['/api/auth/login'],
                components: ['LoginForm', 'AuthProvider'],
              },
            },
            videoEvents: [],
          },
        ],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithVisualCues);
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('Visual Cues Extracted from Video');
      expect(loopOptions.systemPrompt).toContain('NullPointerException');
      expect(loopOptions.systemPrompt).toContain('/api/auth/login');
      expect(loopOptions.systemPrompt).toContain('LoginForm');
    });

    it('uses repo structure in loop options when repo is connected', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(mockRepoCtx);
      (codeInvestigation.getRepoStructure as jest.Mock).mockResolvedValue('📁 src\n  📄 auth.ts');

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.repoCtx).toEqual(mockRepoCtx);
      expect(loopOptions.systemPrompt).toContain('📁 src');
    });

    it('falls back to "Repository structure unavailable." when getRepoStructure throws', async () => {
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(mockRepoCtx);
      (codeInvestigation.getRepoStructure as jest.Mock).mockRejectedValue(new Error('API error'));

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('Repository structure unavailable.');
    });
  });

  describe('buildAgentSystemPrompt (via analyze)', () => {
    beforeEach(() => {
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});
      (prisma.ticketEvent.create as jest.Mock).mockResolvedValue({});
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(null);
      (agenticLoop.run as jest.Mock).mockResolvedValue(mockLoopResult);
      (diagnosisService.extractDiagnosisFromToolCalls as jest.Mock).mockReturnValue(mockDiagnosis);
      (diagnosisService.saveDiagnosis as jest.Mock).mockResolvedValue(undefined);
    });

    it('includes ticket title and description', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicketBase);

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('Login button crashes');
      expect(loopOptions.systemPrompt).toContain('When clicking the login button the app freezes');
    });

    it('includes repo structure when provided', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicketBase);
      (codeInvestigation.getRepoContext as jest.Mock).mockResolvedValue(mockRepoCtx);
      (codeInvestigation.getRepoStructure as jest.Mock).mockResolvedValue('📁 src\n  📄 auth.service.ts');

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('📁 src');
      expect(loopOptions.systemPrompt).toContain('auth.service.ts');
    });

    it('includes OCR text from videoEvents', async () => {
      const ticketWithOcr = {
        ...mockTicketBase,
        media: [
          {
            metadata: null,
            videoEvents: [
              { timestampMs: 500, ocrText: 'Uncaught TypeError: Cannot set property' },
            ],
          },
        ],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithOcr);

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('Uncaught TypeError: Cannot set property');
    });

    it('includes visual cues section when errors/urls/components found', async () => {
      const ticketWithCues = {
        ...mockTicketBase,
        media: [
          {
            metadata: {
              visualCues: {
                errors: ['500 Internal Server Error'],
                urls: [],
                components: [],
              },
            },
            videoEvents: [],
          },
        ],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketWithCues);

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).toContain('Visual Cues Extracted from Video');
      expect(loopOptions.systemPrompt).toContain('500 Internal Server Error');
    });

    it('does not include visual cues section when all cue arrays are empty', async () => {
      const ticketEmptyCues = {
        ...mockTicketBase,
        media: [
          {
            metadata: {
              visualCues: { errors: [], urls: [], components: [] },
            },
            videoEvents: [],
          },
        ],
      };
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(ticketEmptyCues);

      await service.analyze('ticket-123', 'tenant-123');

      const loopOptions = (agenticLoop.run as jest.Mock).mock.calls[0][0];
      expect(loopOptions.systemPrompt).not.toContain('Visual Cues Extracted from Video');
    });
  });
});
