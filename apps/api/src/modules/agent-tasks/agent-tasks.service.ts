import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketTimelineService } from '../tickets/services/ticket-timeline.service';
import { ActionPlan, AgentTaskStatus } from './types/action-plan.types';

@Injectable()
export class AgentTasksService {
  private readonly logger = new Logger(AgentTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketTimeline: TicketTimelineService,
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
    const data: Record<string, any> = { status };

    if (status === 'completed' || status === 'failed') {
      data.completedAt = new Date();
    }

    const task = await this.prisma.agentTask.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated agent task ${id} status to ${status}`);
    return task;
  }

  async setActionPlan(id: string, plan: ActionPlan) {
    const task = await this.prisma.agentTask.update({
      where: { id },
      data: {
        actionPlan: plan as any,
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

  async appendLog(id: string, entry: Record<string, any>) {
    const task = await this.prisma.agentTask.findUnique({
      where: { id },
      select: { executionLog: true },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    const currentLog = (task.executionLog as Record<string, any>[]) || [];
    const updatedLog = [
      ...currentLog,
      { ...entry, timestamp: new Date().toISOString() },
    ];

    return this.prisma.agentTask.update({
      where: { id },
      data: { executionLog: updatedLog },
    });
  }
}
