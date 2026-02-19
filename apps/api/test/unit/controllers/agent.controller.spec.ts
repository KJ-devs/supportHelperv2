import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from '../../../src/modules/agent/agent.controller';
import { AgentService } from '../../../src/modules/agent/agent.service';

describe('AgentController', () => {
  let controller: AgentController;
  let agentService: jest.Mocked<AgentService>;

  const mockSession = {
    id: 'session-123',
    ticketId: 'ticket-123',
    tenantId: 'tenant-123',
    status: 'active',
    messages: [],
    createdAt: new Date(),
  };

  const mockMessage = {
    id: 'msg-123',
    sessionId: 'session-123',
    role: 'assistant',
    content: 'AI response',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        {
          provide: AgentService,
          useValue: {
            startSession: jest.fn(),
            getSession: jest.fn(),
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    agentService = module.get(AgentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startSession', () => {
    it('should start agent session for ticket', async () => {
      (agentService.startSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await controller.startSession('tenant-123', 'ticket-123');

      expect(agentService.startSession).toHaveBeenCalledWith('ticket-123', 'tenant-123');
      expect(result).toEqual(mockSession);
    });
  });

  describe('getSession', () => {
    it('should return session with messages', async () => {
      (agentService.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await controller.getSession('tenant-123', 'session-123');

      expect(agentService.getSession).toHaveBeenCalledWith('session-123', 'tenant-123');
      expect(result).toEqual(mockSession);
    });
  });

  describe('sendMessage', () => {
    it('should send message and return response', async () => {
      (agentService.sendMessage as jest.Mock).mockResolvedValue(mockMessage);

      const result = await controller.sendMessage('tenant-123', 'user-123', 'session-123', { content: 'Hello' } as unknown);

      expect(agentService.sendMessage).toHaveBeenCalledWith('session-123', 'tenant-123', 'Hello', 'user-123');
      expect(result).toEqual(mockMessage);
    });
  });
});
