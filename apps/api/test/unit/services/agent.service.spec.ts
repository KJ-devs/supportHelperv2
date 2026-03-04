import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AgentService, AgentState } from '../../../src/modules/agent/agent.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIService } from '../../../src/ai/ai.service';
import { AgentGateway } from '../../../src/modules/agent/agent.gateway';
import { TicketsGateway } from '../../../src/modules/tickets/tickets.gateway';
import { NotificationService } from '../../../src/modules/notifications/notification.service';

describe('AgentService', () => {
  let service: AgentService;
  let prisma: jest.Mocked<PrismaService>;
  let aiService: jest.Mocked<AIService>;
  let agentGateway: jest.Mocked<AgentGateway>;
  let ticketsGateway: jest.Mocked<TicketsGateway>;
  let notificationService: jest.Mocked<NotificationService>;
  let mockAgentQueue: { add: jest.Mock; getJob: jest.Mock };

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
      ticketId: 'ticket-123',
      tenantId: 'tenant-123',
      decisionTrace: [],
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
    name: 'Admin User',
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    const mockAIService = {
      generateCompletion: jest.fn(),
    };

    const mockAgentGatewayObj = {
      emitSessionUpdate: jest.fn(),
      emitNewMessage: jest.fn(),
      emitAgentTyping: jest.fn(),
    };

    const mockTicketsGateway = {
      emitTicketAssigned: jest.fn(),
      emitEscalation: jest.fn(),
    };

    const mockNotificationService = {
      dispatchNotification: jest.fn().mockResolvedValue(undefined),
    };

    mockAgentQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn().mockResolvedValue(null),
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
          useValue: mockAgentGatewayObj,
        },
        {
          provide: getQueueToken('agent-orchestration'),
          useValue: mockAgentQueue,
        },
        {
          provide: TicketsGateway,
          useValue: mockTicketsGateway,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    prisma = module.get(PrismaService);
    aiService = module.get(AIService);
    agentGateway = module.get(AgentGateway);
    ticketsGateway = module.get(TicketsGateway);
    notificationService = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should start agent session for a valid ticket and enqueue analysis job', async () => {
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
            ticketId: 'ticket-123',
            tenantId: 'tenant-123',
            decisionTrace: [],
          },
        },
      });

      // Verify analysis job was enqueued
      expect(mockAgentQueue.add).toHaveBeenCalledWith(
        'analyze-ticket',
        expect.objectContaining({
          type: 'analyze-ticket',
          ticketId: 'ticket-123',
          tenantId: 'tenant-123',
          sessionId: 'session-123',
        }),
        expect.any(Object),
      );

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

    it('should save user message, broadcast it, and return immediately', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(
        mockSessionWithMessages,
      );
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue(mockUserMessage);
      // AI service mock for the async fire-and-forget
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
      expect(prisma.agentMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          role: 'user',
          content: 'I need help with this bug',
          channel: 'web',
        },
      });

      // Verify user message was broadcast
      expect(agentGateway.emitNewMessage).toHaveBeenCalledWith(
        'session-123',
        mockUserMessage,
      );

      // Returns user message immediately (not agent message)
      expect(result).toEqual(mockUserMessage);
    });

    it('should transition state from NEEDS_INFO to ANALYZING when user replies', async () => {
      const needsInfoSession = {
        ...mockSessionWithMessages,
        status: AgentState.NEEDS_INFO,
      };
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(needsInfoSession);
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue(mockUserMessage);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue('Thanks for the info.');

      await service.sendMessage('session-123', 'tenant-123', 'Here is more info');

      // Verify state transition
      expect(prisma.agentSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { status: AgentState.ANALYZING },
      });

      // Verify session update was broadcast
      expect(agentGateway.emitSessionUpdate).toHaveBeenCalledWith(
        'session-123',
        { status: AgentState.ANALYZING },
      );
    });

    it('should transition state from WAITING to ANALYZING when user replies', async () => {
      const waitingSession = {
        ...mockSessionWithMessages,
        status: AgentState.WAITING,
      };
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(waitingSession);
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue(mockUserMessage);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue('Sure, let me help.');

      await service.sendMessage('session-123', 'tenant-123', 'I need more help');

      expect(prisma.agentSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { status: AgentState.ANALYZING },
      });
    });

    it('should cancel timeout job when user replies to NEEDS_INFO session', async () => {
      const needsInfoSession = {
        ...mockSessionWithMessages,
        status: AgentState.NEEDS_INFO,
      };
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(needsInfoSession);
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue(mockUserMessage);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue('Thanks.');

      const mockJob = { remove: jest.fn().mockResolvedValue(undefined) };
      mockAgentQueue.getJob.mockResolvedValue(mockJob);

      await service.sendMessage('session-123', 'tenant-123', 'Here is the info');

      // Verify timeout job was looked up and cancelled
      expect(mockAgentQueue.getJob).toHaveBeenCalledWith('timeout:session-123');
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should throw error when session is not found', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.sendMessage('missing', 'tenant-123', 'Hello'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processUserMessageAsync', () => {
    const mockSessionWithMessages = {
      ...mockSession,
      status: AgentState.ANALYZING,
      messages: [
        { role: 'agent', content: 'How can I help you?' },
        { role: 'user', content: 'My app crashes' },
      ],
      ticket: mockTicket,
    };

    it('should generate AI response and broadcast it', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(mockSessionWithMessages);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(
        'I see the issue. Let me help you fix it.',
      );
      const mockAgentMsg = {
        id: 'agent-msg-1',
        sessionId: 'session-123',
        role: 'agent',
        content: 'I see the issue. Let me help you fix it.',
        channel: 'web',
      };
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue(mockAgentMsg);

      await service.processUserMessageAsync('session-123', 'tenant-123', 'My app crashes');

      // Verify typing indicators
      expect(agentGateway.emitAgentTyping).toHaveBeenCalledWith('session-123', true);
      expect(agentGateway.emitAgentTyping).toHaveBeenCalledWith('session-123', false);

      // Verify AI was called
      expect(aiService.generateCompletion).toHaveBeenCalled();

      // Verify agent message was created and broadcast
      expect(prisma.agentMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          role: 'agent',
          content: 'I see the issue. Let me help you fix it.',
          channel: 'web',
        },
      });
      expect(agentGateway.emitNewMessage).toHaveBeenCalledWith('session-123', mockAgentMsg);
    });

    it('should schedule timeout when response leads to NEEDS_INFO state', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(mockSessionWithMessages);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(
        'Could you provide more details about when this happens?',
      );
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        role: 'agent',
        content: 'Could you provide more details about when this happens?',
      });

      await service.processUserMessageAsync('session-123', 'tenant-123', 'Help');

      // Verify session updated to NEEDS_INFO
      expect(prisma.agentSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { status: AgentState.NEEDS_INFO },
      });

      // Verify timeout job was scheduled
      expect(mockAgentQueue.add).toHaveBeenCalledWith(
        'auto-escalate-timeout',
        expect.objectContaining({
          type: 'auto-escalate-timeout',
          sessionId: 'session-123',
        }),
        expect.objectContaining({
          delay: 24 * 60 * 60 * 1000,
          jobId: 'timeout:session-123',
        }),
      );
    });

    it('should stop typing indicator on error', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(mockSessionWithMessages);
      (aiService.generateCompletion as jest.Mock).mockRejectedValue(new Error('AI failed'));

      await expect(
        service.processUserMessageAsync('session-123', 'tenant-123', 'Help'),
      ).rejects.toThrow('AI failed');

      expect(agentGateway.emitAgentTyping).toHaveBeenCalledWith('session-123', true);
      expect(agentGateway.emitAgentTyping).toHaveBeenCalledWith('session-123', false);
    });

    // AC1: addMessage(sessionId, 'assistant', content) → creates AgentMessage role 'agent'
    it('should create agent message with role "agent" (assistant role)', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(mockSessionWithMessages);
      (aiService.generateCompletion as jest.Mock).mockResolvedValue(
        'Here is a solution to your problem.',
      );
      const mockAgentMsg = {
        id: 'agent-msg-assistant',
        sessionId: 'session-123',
        role: 'agent',
        content: 'Here is a solution to your problem.',
        channel: 'web',
        createdAt: new Date(),
      };
      (prisma.agentMessage.create as jest.Mock).mockResolvedValue(mockAgentMsg);

      await service.processUserMessageAsync('session-123', 'tenant-123', 'How do I fix it?');

      // Verify the created message has role 'agent' (the service's assistant role)
      expect(prisma.agentMessage.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-123',
          role: 'agent',
          content: 'Here is a solution to your problem.',
          channel: 'web',
        },
      });
    });
  });

  // AC2: getMessages(sessionId) → messages ordered by createdAt
  describe('getMessages ordering (via getSession)', () => {
    it('should return messages ordered by createdAt ascending', async () => {
      const t1 = new Date('2026-01-01T10:00:00Z');
      const t2 = new Date('2026-01-01T10:01:00Z');
      const t3 = new Date('2026-01-01T10:02:00Z');

      const orderedMessages = [
        { id: 'msg-1', role: 'agent', content: 'Hello', createdAt: t1 },
        { id: 'msg-2', role: 'user', content: 'I need help', createdAt: t2 },
        { id: 'msg-3', role: 'agent', content: 'Sure!', createdAt: t3 },
      ];

      const sessionWithOrderedMessages = {
        ...mockSession,
        messages: orderedMessages,
        ticket: mockTicket,
      };

      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(
        sessionWithOrderedMessages,
      );

      const result = await service.getSession('session-123', 'tenant-123');

      // Verify the query requests ascending createdAt order
      expect(prisma.agentSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          }),
        }),
      );

      // Verify messages are in ascending chronological order
      const messages = result.messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].createdAt.getTime()).toBeLessThan(messages[1].createdAt.getTime());
      expect(messages[1].createdAt.getTime()).toBeLessThan(messages[2].createdAt.getTime());
    });
  });

  // AC3 & AC4: state transition tests
  describe('resolveSession', () => {
    const mockSessionWithMessages = {
      ...mockSession,
      status: AgentState.ANALYZING,
      messages: [],
      ticket: mockTicket,
    };

    // AC3: Transition ANALYZING → RESOLVED → valid
    it('should transition session from ANALYZING to RESOLVED (valid transition)', async () => {
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(
        mockSessionWithMessages,
      );
      const resolvedSession = { ...mockSession, status: AgentState.RESOLVED };
      (prisma.agentSession.update as jest.Mock).mockResolvedValue(resolvedSession);

      const result = await service.resolveSession('session-123', 'tenant-123');

      expect(prisma.agentSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: { status: AgentState.RESOLVED },
      });

      expect(agentGateway.emitSessionUpdate).toHaveBeenCalledWith(
        'session-123',
        { status: AgentState.RESOLVED },
      );

      expect(result.status).toBe(AgentState.RESOLVED);
    });

    // AC4: Transition RESOLVED → ANALYZING → invalid (session closed)
    it('should reject sendMessage when session is RESOLVED (session closed)', async () => {
      const resolvedSession = {
        ...mockSessionWithMessages,
        status: AgentState.RESOLVED,
      };
      (prisma.agentSession.findFirst as jest.Mock).mockResolvedValue(resolvedSession);

      await expect(
        service.sendMessage('session-123', 'tenant-123', 'Can you help me again?'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.sendMessage('session-123', 'tenant-123', 'Can you help me again?'),
      ).rejects.toThrow('Cannot send messages to a closed session');

      // Verify no message was created and no state transition attempted
      expect(prisma.agentMessage.create).not.toHaveBeenCalled();
      expect(prisma.agentSession.update).not.toHaveBeenCalled();
    });
  });
});
