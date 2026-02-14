import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentService, AgentState } from '../../../src/modules/agent/agent.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIService } from '../../../src/ai/ai.service';
import { AgentGateway } from '../../../src/modules/agent/agent.gateway';

describe('AgentService', () => {
  let service: AgentService;
  let prisma: jest.Mocked<PrismaService>;
  let aiService: jest.Mocked<AIService>;
  let agentGateway: jest.Mocked<AgentGateway>;

  const mockTicket = {
    id: 'ticket-123',
    tenantId: 'tenant-123',
    title: 'Test bug report',
    description: 'The app crashes when clicking the submit button',
    type: 'bug',
    severity: 'high',
    aiSummary: 'Button click causes application crash',
    media: [],
    application: {
      id: 'app-123',
      name: 'Test App',
    },
  };

  const mockSession = {
    id: 'session-123',
    ticketId: 'ticket-123',
    status: AgentState.ANALYZING,
    agentState: {
      step: 'initial_analysis',
      context: {},
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    escalatedTo: null,
    escalationReason: null,
  };

  const mockMessage = {
    id: 'message-123',
    sessionId: 'session-123',
    role: 'user',
    content: 'Can you help me fix this?',
    channel: 'web',
    createdAt: new Date(),
    metadata: null,
  };

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-123',
    email: 'admin@example.com',
    role: 'admin',
  };

  beforeEach(async () => {
    const mockPrisma = {
      ticket: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      agentSession: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      agentMessage: {
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    const mockAIService = {
      generateCompletion: jest.fn(),
    };

    const mockAgentGateway = {
      emitSessionUpdate: jest.fn(),
      emitNewMessage: jest.fn(),
      emitAgentTyping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AIService,
          useValue: mockAIService,
        },
        {
          provide: AgentGateway,
          useValue: mockAgentGateway,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    prisma = module.get(PrismaService);
    aiService = module.get(AIService);
    agentGateway = module.get(AgentGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should start agent session for a valid ticket', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.agentSession.create as jest.Mock).mockResolvedValue(mockSession);

      const result = await service.startSession('ticket-123', 'tenant-123');

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-123', tenantId: 'tenant-123' },
        include: {
          media: true,
          application: true,
        },
      });

      expect(prisma.agentSession.create).toHaveBeenCalledWith({
        data: {
          ticketId: 'ticket-123',
          status: AgentState.ANALYZING,
          agentState: {
            step: 'initial_analysis',
            context: {},
          },
        },
      });

      expect(result).toEqual(mockSession);
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.startSession('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.startSession('missing', 'tenant-123')).rejects.toThrow(
        'Ticket not found',
      );
    });

    it('should throw NotFoundException when ticket belongs to different tenant', async () => {
      (prisma.ticket.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.startSession('ticket-123', 'wrong-tenant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSession', () => {
    const mockSessionWithMessages = {
      ...mockSession,
      messages: [mockMessage],
      ticket: mockTicket,
    };

    it('should return session with messages for valid session', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(
        mockSessionWithMessages,
      );

      const result = await service.getSession('session-123', 'tenant-123');

      expect(prisma.agentSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'session-123',
          ticket: { tenantId: 'tenant-123' },
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          ticket: true,
        },
      });

      expect(result).toEqual(mockSessionWithMessages);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getSession('missing', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getSession('missing', 'tenant-123')).rejects.toThrow(
        'Agent session not found',
      );
    });

    it('should throw NotFoundException when session belongs to different tenant', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getSession('session-123', 'wrong-tenant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sendMessage', () => {
    const mockSessionWithMessages = {
      ...mockSession,
      messages: [
        {
          role: 'agent',
          content: 'Hello! How can I help you?',
        },
      ],
      ticket: mockTicket,
    };

    const mockUserMessage = {
      id: 'user-message-123',
      sessionId: 'session-123',
      role: 'user',
      content: 'I need help with this bug',
      channel: 'web',
      createdAt: new Date(),
    };

    const mockAgentMessage = {
      id: 'agent-message-123',
      sessionId: 'session-123',
      role: 'agent',
      content: 'Let me analyze the ticket details...',
      channel: 'web',
      createdAt: new Date(),
    };

    it('should send message and generate agent response', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(
        mockSessionWithMessages,
      );
      (prisma.agentMessage.create as jest.Mock)
        .mockResolvedValueOnce(mockUserMessage)
        .mockResolvedValueOnce(mockAgentMessage);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(
        'Let me analyze the ticket details...',
      );

      const result = await service.sendMessage(
        'session-123',
        'tenant-123',
        'I need help with this bug',
        'user-123',
      );

      // Verify session was fetched
      expect(prisma.agentSession.findFirst).toHaveBeenCalled();

      // Verify user message was created
      expect(prisma.agentMessage.create).toHaveBeenNthCalledWith(1, {
        data: {
          sessionId: 'session-123',
          role: 'user',
          content: 'I need help with this bug',
          channel: 'web',
        },
      });

      // Verify typing indicators were emitted
      expect(agentGateway.emitAgentTyping).toHaveBeenNthCalledWith(1, 'session-123', true);
      expect(agentGateway.emitAgentTyping).toHaveBeenNthCalledWith(2, 'session-123', false);

      // Verify AI service was called
      expect(aiService.generateCompletion).toHaveBeenCalled();

      // Verify agent message was created
      expect(prisma.agentMessage.create).toHaveBeenNthCalledWith(2, {
        data: {
          sessionId: 'session-123',
          role: 'agent',
          content: 'Let me analyze the ticket details...',
          channel: 'web',
        },
      });

      // Verify messages were broadcast
      expect(agentGateway.emitNewMessage).toHaveBeenCalledTimes(2);

      expect(result).toEqual(mockAgentMessage);
    });

    it('should throw error when session is not found', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.sendMessage('missing', 'tenant-123', 'Hello'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
