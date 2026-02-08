import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentService, AgentState } from './agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';

describe('AgentService', () => {
  let service: AgentService;
  let prisma: PrismaService;
  let aiService: AIService;

  const mockTenantId = 'tenant-123';
  const mockTicketId = 'ticket-123';
  const mockSessionId = 'session-123';

  const mockTicket = {
    id: mockTicketId,
    tenantId: mockTenantId,
    title: 'Login not working',
    description: 'Cannot login to the application',
    status: 'open',
    type: 'bug',
    severity: 'high',
    aiSummary: 'User cannot access their account',
    reproductionSteps: ['Go to login', 'Enter credentials', 'Click submit'],
    userContext: { os: 'Windows', browser: 'Chrome' },
    media: [],
    application: { id: 'app-1', name: 'Test App' },
  };

  const mockSession = {
    id: mockSessionId,
    ticketId: mockTicketId,
    status: AgentState.ANALYZING,
    agentState: { step: 'initial_analysis', context: {} },
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    ticket: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    agentSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    agentMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockAiService = {
    generateCompletion: jest.fn(),
    classifyTicket: jest.fn(),
    summarizeTicket: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AIService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AIService>(AIService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should create a new agent session for a ticket', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.agentSession.create.mockResolvedValue(mockSession);
      mockAiService.generateCompletion.mockResolvedValue(
        JSON.stringify({
          summary: 'Authentication issue',
          severity: 'high',
          confidence: 85,
          needsEscalation: false,
        })
      );

      const result = await service.startSession(mockTicketId, mockTenantId);

      expect(result).toEqual(mockSession);
      expect(mockPrismaService.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: mockTicketId, tenantId: mockTenantId },
        include: { media: true, application: true },
      });
      expect(mockPrismaService.agentSession.create).toHaveBeenCalledWith({
        data: {
          ticketId: mockTicketId,
          status: AgentState.ANALYZING,
          agentState: {
            step: 'initial_analysis',
            context: {},
          },
        },
      });
    });

    it('should throw NotFoundException when ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(service.startSession(mockTicketId, mockTenantId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('AgentState enum', () => {
    it('should have correct states', () => {
      expect(AgentState.ANALYZING).toBe('analyzing');
      expect(AgentState.NEEDS_INFO).toBe('needs_info');
      expect(AgentState.PROPOSING).toBe('proposing');
      expect(AgentState.WAITING).toBe('waiting');
      expect(AgentState.RESOLVED).toBe('resolved');
      expect(AgentState.ESCALATED).toBe('escalated');
    });
  });

  describe('AI Analysis', () => {
    beforeEach(() => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.agentSession.create.mockResolvedValue(mockSession);
      mockPrismaService.agentSession.update.mockResolvedValue({});
    });

    it('should escalate when confidence is low', async () => {
      mockAiService.generateCompletion.mockResolvedValue(
        JSON.stringify({
          summary: 'Unknown issue',
          severity: 'medium',
          confidence: 30,
          needsEscalation: false,
        })
      );

      await service.startSession(mockTicketId, mockTenantId);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockPrismaService.agentSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSessionId },
          data: expect.objectContaining({
            status: AgentState.ESCALATED,
          }),
        })
      );
    });

    it('should escalate when needsEscalation is true', async () => {
      mockAiService.generateCompletion.mockResolvedValue(
        JSON.stringify({
          summary: 'Complex issue',
          severity: 'critical',
          confidence: 90,
          needsEscalation: true,
        })
      );

      await service.startSession(mockTicketId, mockTenantId);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockPrismaService.agentSession.update).toHaveBeenCalled();
    });

    it('should handle non-JSON AI response', async () => {
      mockAiService.generateCompletion.mockResolvedValue(
        'This is not JSON, just a plain text response about the issue.'
      );

      await service.startSession(mockTicketId, mockTenantId);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still process without throwing
      expect(mockPrismaService.agentSession.update).toHaveBeenCalled();
    });

    it('should handle AI service error', async () => {
      mockAiService.generateCompletion.mockRejectedValue(new Error('AI service unavailable'));

      await service.startSession(mockTicketId, mockTenantId);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should escalate on error
      expect(mockPrismaService.agentSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AgentState.ESCALATED,
            escalationReason: expect.stringContaining('Analysis failed'),
          }),
        })
      );
    });
  });
});
