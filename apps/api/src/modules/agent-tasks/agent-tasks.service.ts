import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketTimelineService } from '../tickets/services/ticket-timeline.service';
import { ActionPlan, AgentTaskStatus } from './types/action-plan.types';

/** Maps AgentTask status → Ticket status for automatic sync */
const TASK_TO_TICKET_STATUS: Record<string, string | null> = {
  analyzing: 'analyzing',
  plan_pending_review: 'in_progress',
  code_pending_review: 'in_progress',
  plan_approved: 'in_progress',
  code_approved: 'in_progress',
  generating: 'in_progress',
  pushing: 'in_progress',
  pr_created: 'in_progress',
  completed: 'resolved',
  failed: 'open',
  expired: 'open',
};

@Injectable()
export class AgentTasksService {
  private readonly logger = new Logger(AgentTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketTimeline: TicketTimelineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(ticketId: string, tenantId: string, applicationId: string) {
    const task = await this.prisma.agentTask.create({
      data: {
        ticketId,
        tenantId,
        applicationId,
        status: 'analyzing',
        startedAt: new Date(),
        executionLog: [],
      },
    });

    this.logger.log(`Created agent task ${task.id} for ticket ${ticketId}`);

    await this.ticketTimeline.recordEvent(
      ticketId,
      tenantId,
      'agent_analysis_started',
      { agentTaskId: task.id },
    );

    return task;
  }

  async findById(id: string) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
      include: { ticket: true },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    return task;
  }

  async findByTicketId(ticketId: string) {
    return this.prisma.agentTask.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: AgentTaskStatus) {
    // Read previous status for event emission
    const previous = await this.prisma.agentTask.findUnique({
      where: { id },
      select: { status: true, ticketId: true, tenantId: true },
    });

    const data: Prisma.AgentTaskUpdateInput = { status };

    if (status === 'completed' || status === 'failed') {
      data.completedAt = new Date();
    }

    const task = await this.prisma.agentTask.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated agent task ${id} status to ${status}`);

    // Emit WebSocket event for real-time UI updates
    this.eventEmitter.emit('agent-task:status-changed', {
      taskId: id,
      previousStatus: previous?.status,
      newStatus: status,
    });

    // Sync ticket status based on agent task status
    if (previous) {
      const ticketStatus = TASK_TO_TICKET_STATUS[status];
      if (ticketStatus) {
        await this.prisma.ticket.update({
          where: { id: previous.ticketId },
          data: { status: ticketStatus },
        });
        this.logger.log(
          `Synced ticket ${previous.ticketId} status to '${ticketStatus}' (from task status '${status}')`,
        );
      }
    }

    return task;
  }

  async setActionPlan(id: string, plan: ActionPlan) {
    const task = await this.prisma.agentTask.update({
      where: { id },
      data: {
        actionPlan: plan as unknown as Prisma.InputJsonValue,
        status: 'plan_ready',
      },
    });

    this.logger.log(`Set action plan for agent task ${id}`);

    await this.ticketTimeline.recordEvent(
      task.ticketId,
      task.tenantId,
      'agent_plan_ready',
      { agentTaskId: id },
    );

    return task;
  }

  async approve(id: string) {
    const task = await this.prisma.agentTask.update({
      where: { id },
      data: { status: 'plan_approved' },
    });

    this.logger.log(`Approved agent task ${id}`);

    await this.ticketTimeline.recordEvent(
      task.ticketId,
      task.tenantId,
      'agent_plan_approved',
      { agentTaskId: id },
    );

    return task;
  }

  async setError(id: string, error: string) {
    const task = await this.prisma.agentTask.update({
      where: { id },
      data: {
        error,
        status: 'failed',
        completedAt: new Date(),
      },
    });

    this.logger.error(`Agent task ${id} failed: ${error}`);
    return task;
  }

  async appendLog(id: string, entry: Prisma.InputJsonObject) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
      select: { executionLog: true },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    const currentLog = (task.executionLog as Prisma.JsonArray) || [];
    const updatedLog = [
      ...currentLog,
      { ...entry, timestamp: new Date().toISOString() },
    ];

    return this.prisma.agentTask.update({
      where: { id },
      data: { executionLog: updatedLog },
    });
  }

  async findAll(
    tenantId: string,
    filters: {
      status?: string;
      applicationId?: string;
      severity?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page: number;
      limit: number;
    },
  ) {
    const where: Prisma.AgentTaskWhereInput = { tenantId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.applicationId) {
      where.applicationId = filters.applicationId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }
    const ticketFilter: Prisma.TicketWhereInput = {};
    if (filters.severity) {
      ticketFilter.severity = filters.severity;
    }
    if (filters.search) {
      ticketFilter.title = { contains: filters.search, mode: 'insensitive' };
    }
    if (Object.keys(ticketFilter).length > 0) {
      where.ticket = { is: ticketFilter };
    }

    const [data, total] = await Promise.all([
      this.prisma.agentTask.findMany({
        where,
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
              type: true,
            },
          },
          application: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: filters.page * filters.limit,
        take: filters.limit,
      }),
      this.prisma.agentTask.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getStats(tenantId: string) {
    const tasks = await this.prisma.agentTask.findMany({
      where: { tenantId },
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const totalTasks = tasks.length;
    const inProgress = tasks.filter((t) =>
      !['completed', 'failed', 'expired'].includes(t.status),
    ).length;
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const failedCount = tasks.filter((t) => t.status === 'failed').length;

    const finishedTasks = tasks.filter((t) =>
      ['completed', 'failed'].includes(t.status),
    );
    const successRate =
      finishedTasks.length > 0
        ? Math.round((completedTasks.length / finishedTasks.length) * 100)
        : 0;

    // Calculate average resolution time in minutes
    const completedWithTimes = completedTasks.filter(
      (t) => t.startedAt && t.completedAt,
    );
    const avgResolutionTime =
      completedWithTimes.length > 0
        ? Math.round(
            completedWithTimes.reduce((sum, t) => {
              const duration =
                new Date(t.completedAt!).getTime() -
                new Date(t.startedAt!).getTime();
              return sum + duration;
            }, 0) /
              completedWithTimes.length /
              60000,
          )
        : 0;

    const byStatus: Record<string, number> = {};
    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    }

    return {
      totalTasks,
      inProgress,
      successRate,
      avgResolutionTime,
      failedCount,
      byStatus,
    };
  }

  async retry(id: string) {
    // Read current log first since JSON columns don't support push
    const existing = await this.prisma.agentTask.findUnique({
      where: { id },
      select: { executionLog: true },
    });
    const currentLog = (existing?.executionLog as Prisma.JsonArray) || [];

    const task = await this.prisma.agentTask.update({
      where: { id },
      data: {
        status: 'analyzing',
        error: null,
        completedAt: null,
        startedAt: new Date(),
        executionLog: [
          ...currentLog,
          {
            step: 'manual_retry',
            message: 'Task manually retried by user',
            timestamp: new Date().toISOString(),
          },
        ],
      },
      include: { ticket: true },
    });

    this.logger.log(`Retried agent task ${id}`);

    await this.ticketTimeline.recordEvent(
      task.ticketId,
      task.tenantId,
      'agent_task_retried',
      { agentTaskId: id },
    );

    return task;
  }

  async cancel(id: string) {
    // Read current log first since JSON columns don't support push
    const existing = await this.prisma.agentTask.findUnique({
      where: { id },
      select: { executionLog: true },
    });
    const currentLog = (existing?.executionLog as Prisma.JsonArray) || [];

    const task = await this.prisma.agentTask.update({
      where: { id },
      data: {
        status: 'failed',
        error: 'Cancelled by user',
        completedAt: new Date(),
        executionLog: [
          ...currentLog,
          {
            step: 'cancelled',
            message: 'Task cancelled by user',
            timestamp: new Date().toISOString(),
          },
        ],
      },
      include: { ticket: true },
    });

    this.logger.log(`Cancelled agent task ${id}`);

    await this.ticketTimeline.recordEvent(
      task.ticketId,
      task.tenantId,
      'agent_task_cancelled',
      { agentTaskId: id },
    );

    return task;
  }
}
