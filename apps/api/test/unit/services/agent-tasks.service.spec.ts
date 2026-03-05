import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentTasksService } from '../../../src/modules/agent-tasks/agent-tasks.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TicketTimelineService } from '../../../src/modules/tickets/services/ticket-timeline.service';

describe('AgentTasksService', () => {
  let service: AgentTasksService;
  let prisma: PrismaService;
  let ticketTimeline: TicketTimelineService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    agentTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockTicketTimelineService = {
    recordEvent: jest.fn(),
  };

  const tenantId = 'tenant-123';
  const applicationId = 'app-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentTasksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TicketTimelineService,
          useValue: mockTicketTimelineService,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AgentTasksService>(AgentTasksService);
    prisma = module.get<PrismaService>(PrismaService);
    ticketTimeline = module.get<TicketTimelineService>(TicketTimelineService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create agent task and record timeline event', async () => {
      const ticketId = 'ticket-123';
      const task = {
        id: 'task-123',
        ticketId,
        tenantId,
        applicationId,
        status: 'analyzing',
        executionLog: [],
      };

      mockPrismaService.agentTask.create.mockResolvedValue(task);

      const result = await service.create(ticketId, tenantId, applicationId);

      expect(result).toEqual(task);
      expect(prisma.agentTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId,
          tenantId,
          applicationId,
          status: 'analyzing',
          executionLog: [],
        }),
      });
      expect(ticketTimeline.recordEvent).toHaveBeenCalledWith(
        ticketId,
        tenantId,
        'agent_analysis_started',
        { agentTaskId: task.id }
      );
    });
  });

  describe('findById', () => {
    it('should return agent task with ticket', async () => {
      const task = {
        id: 'task-123',
        tenantId,
        ticket: { id: 'ticket-123', title: 'Test' },
      };

      mockPrismaService.agentTask.findUnique.mockResolvedValue(task);

      const result = await service.findById('task-123');

      expect(result).toEqual(task);
      expect(prisma.agentTask.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        include: { ticket: true },
      });
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrismaService.agentTask.findUnique.mockResolvedValue(null);

      await expect(service.findById('not-found')).rejects.toThrow(NotFoundException);
      await expect(service.findById('not-found')).rejects.toThrow('Agent task not-found not found');
    });
  });

  describe('findByTicketId', () => {
    it('should return all tasks for ticket ordered by creation date', async () => {
      const tasks = [
        { id: 'task-1', createdAt: new Date() },
        { id: 'task-2', createdAt: new Date() },
      ];

      mockPrismaService.agentTask.findMany.mockResolvedValue(tasks);

      const result = await service.findByTicketId('ticket-123');

      expect(result).toEqual(tasks);
      expect(prisma.agentTask.findMany).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status to completed with completedAt', async () => {
      const task = { id: 'task-123', status: 'completed' };

      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.updateStatus('task-123', 'completed');

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should update status to analyzing without completedAt', async () => {
      const task = { id: 'task-456', status: 'analyzing' };

      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.updateStatus('task-456', 'analyzing');

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-456' },
        data: { status: 'analyzing' },
      });
    });
  });

  describe('setActionPlan', () => {
    it('should set action plan and record timeline event', async () => {
      const plan = {
        summary: 'Fix authentication bug',
        rootCause: 'JWT token validation issue',
        files: [
          {
            filePath: 'src/auth/auth.service.ts',
            operation: 'modify' as const,
            description: 'Fix JWT validation',
            changeType: 'bug_fix' as const,
            order: 1,
          },
        ],
        testingStrategy: 'Unit tests for JWT validation',
        risks: ['Breaking existing auth flow'],
        estimatedComplexity: 'medium' as const,
      };
      const task = {
        id: 'task-123',
        ticketId: 'ticket-123',
        tenantId,
        status: 'plan_ready',
      };

      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.setActionPlan('task-123', plan);

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          actionPlan: plan,
          status: 'plan_ready',
        },
      });
      expect(ticketTimeline.recordEvent).toHaveBeenCalledWith(
        'ticket-123',
        tenantId,
        'agent_plan_ready',
        { agentTaskId: 'task-123' }
      );
    });
  });

  describe('approve', () => {
    it('should approve task and record timeline event', async () => {
      const task = {
        id: 'task-123',
        ticketId: 'ticket-123',
        tenantId,
        status: 'plan_approved',
      };

      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.approve('task-123');

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: { status: 'plan_approved' },
      });
      expect(ticketTimeline.recordEvent).toHaveBeenCalledWith(
        'ticket-123',
        tenantId,
        'agent_plan_approved',
        { agentTaskId: 'task-123' }
      );
    });
  });

  describe('setError', () => {
    it('should set error and mark task as failed', async () => {
      const task = { id: 'task-123', status: 'failed', error: 'Test error' };

      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.setError('task-123', 'Test error');

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          error: 'Test error',
          status: 'failed',
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('appendLog', () => {
    it('should append entry to execution log', async () => {
      const existingTask = { executionLog: [{ step: 'init', message: 'Started' }] };
      const updatedTask = { executionLog: [{ step: 'init' }, { step: 'analyze' }] };
      const entry = { step: 'analyze', message: 'Analyzing code' };

      mockPrismaService.agentTask.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.agentTask.update.mockResolvedValue(updatedTask);

      const result = await service.appendLog('task-123', entry);

      expect(result).toEqual(updatedTask);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: {
          executionLog: expect.arrayContaining([
            { step: 'init', message: 'Started' },
            expect.objectContaining({
              step: 'analyze',
              message: 'Analyzing code',
              timestamp: expect.any(String),
            }),
          ]),
        },
      });
    });

    it('should emit agent-task:log-appended event after writing to DB', async () => {
      const existingTask = { executionLog: [], tenantId: 'tenant-123' };
      const updatedTask = {
        executionLog: [{ step: 'analyze', timestamp: '2026-01-01T00:00:00.000Z' }],
      };
      const entry = { step: 'analyze', message: 'Analyzing code' };

      mockPrismaService.agentTask.findUnique.mockResolvedValue(existingTask);
      mockPrismaService.agentTask.update.mockResolvedValue(updatedTask);

      await service.appendLog('task-123', entry);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'agent-task:log-appended',
        expect.objectContaining({
          taskId: 'task-123',
          tenantId: 'tenant-123',
          entry: expect.objectContaining({
            step: 'analyze',
            message: 'Analyzing code',
            timestamp: expect.any(String),
          }),
        })
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrismaService.agentTask.findUnique.mockResolvedValue(null);

      await expect(service.appendLog('not-found', { step: 'test' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getStats', () => {
    it('should calculate task statistics', async () => {
      const now = new Date();
      const tasks = [
        {
          status: 'completed',
          startedAt: new Date(now.getTime() - 60000),
          completedAt: now,
        },
        {
          status: 'analyzing',
          startedAt: now,
          completedAt: null,
        },
        {
          status: 'failed',
          startedAt: now,
          completedAt: now,
        },
      ];

      mockPrismaService.agentTask.findMany.mockResolvedValue(tasks);

      const stats = await service.getStats(tenantId);

      expect(stats.totalTasks).toBe(3);
      expect(stats.inProgress).toBe(1);
      expect(stats.failedCount).toBe(1);
      expect(stats.successRate).toBe(50); // 1 of 2 finished tasks
      expect(stats.avgResolutionTime).toBeGreaterThan(0);
      expect(stats.byStatus).toEqual({
        completed: 1,
        analyzing: 1,
        failed: 1,
      });
    });

    it('should handle empty task list', async () => {
      mockPrismaService.agentTask.findMany.mockResolvedValue([]);

      const stats = await service.getStats(tenantId);

      expect(stats.totalTasks).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgResolutionTime).toBe(0);
    });
  });

  describe('retry', () => {
    it('should reset task status and append retry log entry', async () => {
      const existingLog = [{ step: 'failed', message: 'Error occurred' }];
      const existing = { executionLog: existingLog };
      const task = {
        id: 'task-123',
        ticketId: 'ticket-123',
        tenantId,
        status: 'analyzing',
      };

      mockPrismaService.agentTask.findUnique.mockResolvedValue(existing);
      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.retry('task-123');

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          status: 'analyzing',
          error: null,
          completedAt: null,
          startedAt: expect.any(Date),
          executionLog: expect.arrayContaining([
            expect.objectContaining({ step: 'failed' }),
            expect.objectContaining({ step: 'manual_retry' }),
          ]),
        }),
        include: { ticket: true },
      });
      expect(ticketTimeline.recordEvent).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel task and append cancellation log', async () => {
      const existing = { executionLog: [{ step: 'analyzing' }] };
      const task = {
        id: 'task-123',
        ticketId: 'ticket-123',
        tenantId,
        status: 'failed',
        error: 'Cancelled by user',
      };

      mockPrismaService.agentTask.findUnique.mockResolvedValue(existing);
      mockPrismaService.agentTask.update.mockResolvedValue(task);

      const result = await service.cancel('task-123');

      expect(result).toEqual(task);
      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-123' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'Cancelled by user',
          completedAt: expect.any(Date),
          executionLog: expect.arrayContaining([expect.objectContaining({ step: 'cancelled' })]),
        }),
        include: { ticket: true },
      });
    });
  });
});
