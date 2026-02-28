import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AgentService, AgentState } from './agent.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';

describe('AgentService', () => {
  let service: AgentService;
  let _prisma: PrismaService;
  let _aiService: AIService;
  let agentQueue: { add: jest.Mock };

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
    user: {
      findFirst: jest.fn(),
    },
  };

  const mockAiService = {
    generateCompletion: jest.fn(),
    classifyTicket: jest.fn(),
    summarizeTicket: jest.fn(),
  };

  const mockAgentQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
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
        {
          provide: getQueueToken('agent-orchestration'),
          useValue: mockAgentQueue,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    _prisma = module.get<PrismaService>(PrismaService);
    _aiService = module.get<AIService>(AIService);
    agentQueue = module.get(getQueueToken('agent-orchestration'));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should create a new agent session and enqueue an analyze-ticket job', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.agentSession.create.mockResolvedValue(mockSession);
      mockAgentQueue.add.mockResolvedValue({ id: 'job-1' });

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
      // Analysis is now offloaded to the worker via BullMQ
      expect(agentQueue.add).toHaveBeenCalledWith(
        'analyze-ticket',
        {
          type: 'analyze-ticket',
          ticketId: mockTicketId,
          tenantId: mockTenantId,
          sessionId: mockSessionId,
        },
        expect.objectContaining({ priority: 10, attempts: 5 }),
      );
    });

    it('should throw NotFoundException when ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(service.startSession(mockTicketId, mockTenantId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should not call generateCompletion synchronously (analysis is deferred to worker)', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(mockTicket);
      mockPrismaService.agentSession.create.mockResolvedValue(mockSession);
      mockAgentQueue.add.mockResolvedValue({ id: 'job-1' });

      await service.startSession(mockTicketId, mockTenantId);

      // AI analysis is now handled by the worker, not in-process
      expect(mockAiService.generateCompletion).not.toHaveBeenCalled();
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
});
