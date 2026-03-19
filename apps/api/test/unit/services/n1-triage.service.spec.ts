import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { N1TriageService } from '../../../src/modules/n1-triage/n1-triage.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIService } from '../../../src/ai/ai.service';
import { AiPromptConfigService } from '../../../src/modules/ai-config/ai-prompt-config.service';
import { TicketRelationsService } from '../../../src/modules/ticket-relations/ticket-relations.service';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    title: 'Button does not work',
    description: 'The submit button throws an error',
    aiSummary: 'User sees crash on button click',
    type: 'bug',
    typeConfidence: 0.92,
    severity: 'high',
    severityConfidence: 0.85,
    keywords: ['button', 'crash'],
    userContext: {
      browser: 'Chrome 120',
      os: 'Windows 11',
      viewport: '1920x1080',
      url: 'https://app.example.com/dashboard',
    },
    aiAnalysis: null,
    media: [],
    ...overrides,
  };
}

function makeSimilarRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: 'similar-1',
    title: 'Similar crash',
    status: 'resolved',
    type: 'bug',
    severity: 'high',
    ai_summary: 'Similar bug resolved',
    diagnosis: { rootCause: 'Null pointer', suggestedFix: 'Add null check' },
    similarity: 0.88,
    resolved_at: new Date('2026-02-01T10:00:00Z'),
    updated_at: new Date('2026-02-01T12:00:00Z'),
    last_agent_message: 'The fix involved adding a null check in ButtonComponent.tsx',
    ...overrides,
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  ticket: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  agentSession: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'session-1' }),
  },
  agentMessage: {
    create: jest.fn().mockResolvedValue({}),
  },
  ticketEvent: {
    create: jest.fn().mockResolvedValue({}),
  },
  $queryRaw: jest.fn(),
};

const mockAiService = {
  getActiveProvider: jest.fn(),
};

const mockAiPromptConfigService = {
  buildCustomInstructions: jest.fn().mockResolvedValue(''),
  getFeatureFlags: jest
    .fn()
    .mockResolvedValue({ enableTriage: true, enableN1: true, enableN2: true }),
};

const mockTicketRelationsService = {
  createFromN1Assessment: jest.fn().mockResolvedValue(undefined),
};

const mockDeepAnalysisQueue = {
  add: jest.fn().mockResolvedValue({}),
};

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('N1TriageService — context enrichment', () => {
  let service: N1TriageService;
  let prisma: typeof mockPrisma;
  let aiService: typeof mockAiService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        N1TriageService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AIService, useValue: mockAiService },
        { provide: AiPromptConfigService, useValue: mockAiPromptConfigService },
        { provide: TicketRelationsService, useValue: mockTicketRelationsService },
        { provide: getQueueToken('deep-analysis'), useValue: mockDeepAnalysisQueue },
      ],
    }).compile();

    service = module.get<N1TriageService>(N1TriageService);
    prisma = mockPrisma;
    aiService = mockAiService;
  });

  // ── A. userContext ─────────────────────────────────────────────────────

  describe('userContext in prompt', () => {
    it('includes browser and OS in prompt when userContext is present', async () => {
      const ticket = makeTicket({
        userContext: {
          browser: 'Firefox 121',
          os: 'macOS 14',
          viewport: '2560x1600',
          url: 'https://app.test/page',
        },
      });
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([makeSimilarRaw()]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown bug',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const call = mockProvider.generateStructuredOutput.mock.calls[0];
      const prompt = call[0] as string;
      expect(prompt).toContain('Firefox 121');
      expect(prompt).toContain('macOS 14');
    });

    it('omits USER ENVIRONMENT section when userContext is null', async () => {
      const ticket = makeTicket({ userContext: null });
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown bug',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      expect(prompt).not.toContain('USER ENVIRONMENT');
    });
  });

  // ── B. enriched similar tickets ────────────────────────────────────────

  describe('enriched similar tickets', () => {
    it('includes resolvedAt in prompt when available', async () => {
      const ticket = makeTicket();
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([
        makeSimilarRaw({ resolved_at: new Date('2026-01-15T08:00:00Z') }),
      ]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'no_fix_needed',
          confidence: 0.9,
          reasoning: 'Already fixed',
          userResponse: 'Fixed',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      expect(prompt).toContain('2026-01-15');
    });

    it('includes last agent message (resolution message) in prompt', async () => {
      const ticket = makeTicket();
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([
        makeSimilarRaw({ last_agent_message: 'Fixed by adding null check in ButtonComponent.tsx' }),
      ]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'no_fix_needed',
          confidence: 0.9,
          reasoning: 'Already fixed',
          userResponse: 'Fixed',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      expect(prompt).toContain('Fixed by adding null check in ButtonComponent.tsx');
    });

    it('omits resolution message section when last_agent_message is null', async () => {
      const ticket = makeTicket();
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([makeSimilarRaw({ last_agent_message: null })]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      // Should not have "Resolution:" line for this ticket
      expect(prompt).not.toContain('Resolution: Fixed by adding');
    });
  });

  // ── C. limit = 10 and similarity threshold ────────────────────────────

  describe('findSimilarTickets — limit and threshold', () => {
    it('requests 10 similar tickets (not 5)', async () => {
      const ticket = makeTicket();
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      // The $queryRaw call should contain LIMIT 10
      const rawCall = prisma.$queryRaw.mock.calls[0];
      // rawCall[0] is a TemplateStringsArray — join the fragments and interpolated values
      const queryString = (rawCall[0] as TemplateStringsArray).join('?');
      expect(queryString).toContain('LIMIT');
      // The limit value 10 should be among the interpolated parameters
      const params = rawCall.slice(1);
      expect(params).toContain(10);
    });

    it('filters out tickets with similarity <= 0.6', async () => {
      const ticket = makeTicket();
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      // Return one ticket below threshold — service should filter it out
      prisma.$queryRaw.mockResolvedValue([
        makeSimilarRaw({ similarity: 0.55 }),
        makeSimilarRaw({ id: 'similar-2', similarity: 0.75 }),
      ]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      // Only 1 similar ticket should appear (the 0.75 one)
      // The 0.55-similarity ticket (similar-1) should be absent
      const occurrences = (prompt.match(/\[similar-/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  // ── D. workingAsIntendedConfidence signal ─────────────────────────────

  describe('workingAsIntendedConfidence signal', () => {
    it('adds SIGNAL line when workingAsIntendedConfidence > 0.7 in aiAnalysis', async () => {
      const ticket = makeTicket({
        aiAnalysis: { workingAsIntendedConfidence: 0.85 },
      });
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'no_fix_needed',
          confidence: 0.8,
          reasoning: 'Working as intended',
          userResponse: 'Working as intended',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      expect(prompt).toContain(
        'SIGNAL: Triage classification indicates this may be working as intended'
      );
      expect(prompt).toContain('0.85');
    });

    it('does NOT add SIGNAL line when workingAsIntendedConfidence <= 0.7', async () => {
      const ticket = makeTicket({
        aiAnalysis: { workingAsIntendedConfidence: 0.5 },
      });
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      expect(prompt).not.toContain(
        'SIGNAL: Triage classification indicates this may be working as intended'
      );
    });

    it('does NOT add SIGNAL line when aiAnalysis is null', async () => {
      const ticket = makeTicket({ aiAnalysis: null });
      prisma.ticket.findFirst.mockResolvedValue(ticket);
      prisma.$queryRaw.mockResolvedValue([]);

      const mockProvider = {
        generateStructuredOutput: jest.fn().mockResolvedValue({
          decision: 'escalate_n2',
          confidence: 0.5,
          reasoning: 'Unknown',
          userResponse: 'Escalated',
        }),
      };
      aiService.getActiveProvider.mockResolvedValue(mockProvider);

      await service.assess('ticket-1', 'tenant-1', 'app-1');

      const prompt = mockProvider.generateStructuredOutput.mock.calls[0][0] as string;
      expect(prompt).not.toContain('SIGNAL: Triage classification');
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────

  describe('assess — error handling', () => {
    it('returns success=false when ticket not found', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      const result = await service.assess('ticket-missing', 'tenant-1', 'app-1');

      expect(result.success).toBe(false);
      expect(result.decision).toBeNull();
    });
  });
});
