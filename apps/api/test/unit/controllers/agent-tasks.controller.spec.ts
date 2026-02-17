import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentTasksController } from '../../../src/modules/agent-tasks/agent-tasks.controller';
import { AgentTasksService } from '../../../src/modules/agent-tasks/agent-tasks.service';
import { ValidationModeService } from '../../../src/modules/agent-tasks/services/validation-mode.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AgentTasksController', () => {
  let controller: AgentTasksController;
  let agentTasksService: AgentTasksService;
  let validationModeService: ValidationModeService;
  let prisma: PrismaService;
  let agentQueue: Queue;

  const mockAgentTasksService = {
    create: jest.fn(),
    findById: jest.fn(),
    findByTicketId: jest.fn(),
    findAll: jest.fn(),
    getStats: jest.fn(),
    retry: jest.fn(),
    cancel: jest.fn(),
  };

  const mockValidationModeService = {
    listPendingReviews: jest.fn(),
    approveTask: jest.fn(),
    rejectTask: jest.fn(),
  };

  const mockPrismaService = {
    ticket: {
      findFirst: jest.fn(),
    },
  };

  const mockAgentQueue = {
    add: jest.fn(),
  };

  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentTasksController],
      providers: [
        {
          provide: AgentTasksService,
          useValue: mockAgentTasksService,
        },
        {
          provide: ValidationModeService,
          useValue: mockValidationModeService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('agent-orchestration'),
          useValue: mockAgentQueue,
        },
      ],
    }).compile();

    controller = module.get<AgentTasksController>(AgentTasksController);
    agentTasksService = module.get<AgentTasksService>(AgentTasksService);
    validationModeService = module.get<ValidationModeService>(ValidationModeService);
    prisma = module.get<PrismaService>(PrismaService);
    agentQueue = module.get<Queue>(getQueueToken('agent-orchestration'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeTicket', () => {
    it('should create agent task and queue analysis job', async () => {
      const ticketId = 'ticket-123';
      const ticket = { id: ticketId, applicationId: 'app-123' };
      const task = { id: 'task-123', ticketId, tenantId, status: 'analyzing' };

      mockPrismaService.ticket.findFirst.mockResolvedValue(ticket);
      mockAgentTasksService.create.mockResolvedValue(task);

      const result = await controller.analyzeTicket(tenantId, ticketId);

      expect(result).toEqual(task);
      expect(agentTasksService.create).toHaveBeenCalledWith(ticketId, tenantId, 'app-123');
      expect(agentQueue.add).toHaveBeenCalledWith(
        'generate-action-plan',
        expect.objectContaining({
          type: 'generate-action-plan',
          ticketId,
          agentTaskId: 'task-123',
        }),
        expect.objectContaining({
          priority: 5,
          attempts: 3,
        }),
      );
    });

    it('should throw NotFoundException when ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(controller.analyzeTicket(tenantId, 'not-found')).rejects.toThrow(NotFoundException);
      await expect(controller.analyzeTicket(tenantId, 'not-found')).rejects.toThrow('Ticket not-found not found');
    });

    it('should throw BadRequestException when ticket has no application', async () => {
      const ticketId = 'ticket-456';
      const ticket = { id: ticketId, applicationId: null };

      mockPrismaService.ticket.findFirst.mockResolvedValue(ticket);

      await expect(controller.analyzeTicket(tenantId, ticketId)).rejects.toThrow(BadRequestException);
      await expect(controller.analyzeTicket(tenantId, ticketId)).rejects.toThrow(
        'Ticket has no linked application',
      );
    });
  });

  describe('listPendingReviews', () => {
    it('should return list of pending reviews', async () => {
      const reviews = [
        { id: 'task-1', status: 'plan_ready' },
        { id: 'task-2', status: 'code_ready' },
      ];

      mockValidationModeService.listPendingReviews.mockResolvedValue(reviews);

      const result = await controller.listPendingReviews(tenantId);

      expect(result).toEqual(reviews);
      expect(validationModeService.listPendingReviews).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('getStats', () => {
    it('should return agent task statistics', async () => {
      const stats = {
        totalTasks: 100,
        inProgress: 10,
        successRate: 85,
        avgResolutionTime: 30,
      };

      mockAgentTasksService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats(tenantId);

      expect(result).toEqual(stats);
      expect(agentTasksService.getStats).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('findById', () => {
    it('should return agent task when found and belongs to tenant', async () => {
      const task = { id: 'task-123', tenantId, status: 'analyzing' };

      mockAgentTasksService.findById.mockResolvedValue(task);

      const result = await controller.findById(tenantId, 'task-123');

      expect(result).toEqual(task);
    });

    it('should throw NotFoundException when task belongs to different tenant', async () => {
      const task = { id: 'task-456', tenantId: 'other-tenant', status: 'analyzing' };

      mockAgentTasksService.findById.mockResolvedValue(task);

      await expect(controller.findById(tenantId, 'task-456')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should approve plan and queue code generation', async () => {
      const taskId = 'task-123';
      const approvedTask = {
        id: taskId,
        ticketId: 'ticket-123',
        tenantId,
        applicationId: 'app-123',
        status: 'plan_approved',
      };
      const dto = { phase: 'plan' as const };

      mockValidationModeService.approveTask.mockResolvedValue(approvedTask);

      const result = await controller.approve(tenantId, userId, taskId, dto);

      expect(result).toEqual(approvedTask);
      expect(validationModeService.approveTask).toHaveBeenCalledWith(taskId, tenantId, 'plan', userId);
      expect(agentQueue.add).toHaveBeenCalledWith(
        'generate-code',
        expect.objectContaining({
          type: 'generate-code',
          agentTaskId: taskId,
        }),
        expect.anything(),
      );
    });

    it('should approve code and queue push/PR creation', async () => {
      const taskId = 'task-456';
      const approvedTask = {
        id: taskId,
        ticketId: 'ticket-456',
        tenantId,
        applicationId: 'app-456',
        status: 'code_approved',
      };
      const dto = { phase: 'code' as const };

      mockValidationModeService.approveTask.mockResolvedValue(approvedTask);

      const result = await controller.approve(tenantId, userId, taskId, dto);

      expect(result).toEqual(approvedTask);
      expect(agentQueue.add).toHaveBeenCalledWith(
        'push-code',
        expect.objectContaining({
          type: 'push-code',
          agentTaskId: taskId,
        }),
        expect.anything(),
      );
    });
  });

  describe('reject', () => {
    it('should reject task with reason', async () => {
      const taskId = 'task-789';
      const rejectedTask = { id: taskId, status: 'plan_rejected' };
      const dto = { phase: 'plan' as const, reason: 'Incorrect approach' };

      mockValidationModeService.rejectTask.mockResolvedValue(rejectedTask);

      const result = await controller.reject(tenantId, userId, taskId, dto);

      expect(result).toEqual(rejectedTask);
      expect(validationModeService.rejectTask).toHaveBeenCalledWith(
        taskId,
        tenantId,
        'plan',
        userId,
        'Incorrect approach',
      );
    });
  });

  describe('retry', () => {
    it('should retry failed task and requeue analysis', async () => {
      const taskId = 'task-123';
      const task = {
        id: taskId,
        ticketId: 'ticket-123',
        tenantId,
        applicationId: 'app-123',
        status: 'failed',
      };
      const retriedTask = { ...task, status: 'analyzing' };

      mockAgentTasksService.findById.mockResolvedValue(task);
      mockAgentTasksService.retry.mockResolvedValue(retriedTask);

      const result = await controller.retry(tenantId, taskId);

      expect(result).toEqual(retriedTask);
      expect(agentTasksService.retry).toHaveBeenCalledWith(taskId);
      expect(agentQueue.add).toHaveBeenCalledWith(
        'generate-action-plan',
        expect.objectContaining({
          agentTaskId: taskId,
        }),
        expect.anything(),
      );
    });

    it('should throw BadRequestException when task is not failed or expired', async () => {
      const task = { id: 'task-456', tenantId, status: 'analyzing' };

      mockAgentTasksService.findById.mockResolvedValue(task);

      await expect(controller.retry(tenantId, 'task-456')).rejects.toThrow(BadRequestException);
      await expect(controller.retry(tenantId, 'task-456')).rejects.toThrow(
        "Cannot retry task in 'analyzing' status",
      );
    });
  });

  describe('cancel', () => {
    it('should cancel in-progress task', async () => {
      const taskId = 'task-123';
      const task = { id: taskId, tenantId, status: 'analyzing' };
      const cancelledTask = { ...task, status: 'failed' };

      mockAgentTasksService.findById.mockResolvedValue(task);
      mockAgentTasksService.cancel.mockResolvedValue(cancelledTask);

      const result = await controller.cancel(tenantId, taskId);

      expect(result).toEqual(cancelledTask);
      expect(agentTasksService.cancel).toHaveBeenCalledWith(taskId);
    });

    it('should throw BadRequestException when task is in terminal state', async () => {
      const task = { id: 'task-456', tenantId, status: 'completed' };

      mockAgentTasksService.findById.mockResolvedValue(task);

      await expect(controller.cancel(tenantId, 'task-456')).rejects.toThrow(BadRequestException);
      await expect(controller.cancel(tenantId, 'task-456')).rejects.toThrow('already in a terminal state');
    });
  });

  describe('findByTicketId', () => {
    it('should return agent tasks for ticket', async () => {
      const ticketId = 'ticket-123';
      const ticket = { id: ticketId };
      const tasks = [
        { id: 'task-1', ticketId },
        { id: 'task-2', ticketId },
      ];

      mockPrismaService.ticket.findFirst.mockResolvedValue(ticket);
      mockAgentTasksService.findByTicketId.mockResolvedValue(tasks);

      const result = await controller.findByTicketId(tenantId, ticketId);

      expect(result).toEqual(tasks);
      expect(agentTasksService.findByTicketId).toHaveBeenCalledWith(ticketId);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      mockPrismaService.ticket.findFirst.mockResolvedValue(null);

      await expect(controller.findByTicketId(tenantId, 'not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated agent tasks with filters', async () => {
      const result = {
        data: [{ id: 'task-1' }, { id: 'task-2' }],
        pagination: { page: 0, limit: 20, total: 2, totalPages: 1 },
      };

      mockAgentTasksService.findAll.mockResolvedValue(result);

      expect(
        await controller.findAll(tenantId, 'failed', 'app-123', 'critical', undefined, undefined, undefined, '0', '20'),
      ).toEqual(result);
      expect(agentTasksService.findAll).toHaveBeenCalledWith(tenantId, {
        status: 'failed',
        applicationId: 'app-123',
        severity: 'critical',
        dateFrom: undefined,
        dateTo: undefined,
        search: undefined,
        page: 0,
        limit: 20,
      });
    });

    it('should use default pagination when not provided', async () => {
      const result = {
        data: [],
        pagination: { page: 0, limit: 20, total: 0, totalPages: 0 },
      };

      mockAgentTasksService.findAll.mockResolvedValue(result);

      await controller.findAll(tenantId);

      expect(agentTasksService.findAll).toHaveBeenCalledWith(tenantId, {
        status: undefined,
        applicationId: undefined,
        severity: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        search: undefined,
        page: 0,
        limit: 20,
      });
    });
  });
});
