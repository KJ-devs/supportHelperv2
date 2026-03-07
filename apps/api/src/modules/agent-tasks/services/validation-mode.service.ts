import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentTasksService } from '../agent-tasks.service';
import { AgentMode, ReviewPhase } from '../types/action-plan.types';

const MAX_PLAN_ITERATIONS = 3;

@Injectable()
export class ValidationModeService {
  private readonly logger = new Logger(ValidationModeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('agent-orchestration')
    private readonly agentQueue: Queue,
    private readonly agentTasksService: AgentTasksService
  ) {}

  /**
   * Get the agent mode for a given application (project).
   * Reads from ProjectGithubConfig.settings.agentMode.
   * Defaults to 'auto' if not set.
   */
  async getAgentMode(applicationId: string): Promise<AgentMode> {
    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId, isPrimary: true },
    });

    if (!config) {
      return 'auto';
    }

    const settings = (config.settings as Record<string, unknown>) ?? {};
    const mode = settings.agentMode;

    if (mode === 'review_plan' || mode === 'review_all') {
      return mode;
    }

    return 'auto';
  }

  /**
   * Check whether the agent pipeline should wait for review at the given phase.
   */
  async shouldWaitForReview(applicationId: string, phase: ReviewPhase): Promise<boolean> {
    const mode = await this.getAgentMode(applicationId);

    if (mode === 'auto') {
      return false;
    }

    if (mode === 'review_plan') {
      return phase === 'plan';
    }

    // review_all: review both plan and code
    return true;
  }

  /**
   * Transition an agent task into pending review state.
   * Called by the pipeline when a checkpoint is reached and review is needed.
   */
  async requestReview(taskId: string, phase: ReviewPhase): Promise<void> {
    const task = await this.prisma.agentTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${taskId} not found`);
    }

    const pendingStatus = phase === 'plan' ? 'plan_pending_review' : 'code_pending_review';

    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: pendingStatus,
        reviewRequestedAt: new Date(),
      },
    });

    this.logger.log(`Review requested for task ${taskId} (phase: ${phase})`);

    this.agentTasksService
      .appendLog(taskId, {
        step: 'review_requested',
        message: `Review requested for phase: ${phase}`,
      })
      .catch(() => {});
  }

  /**
   * Approve a task at the given phase.
   * Returns the updated task.
   */
  async approveTask(taskId: string, tenantId: string, phase: ReviewPhase, reviewerId: string) {
    const task = await this.prisma.agentTask.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${taskId} not found`);
    }

    // Also allow approving from plan_ready / code_ready for backward compat
    const validStatuses =
      phase === 'plan'
        ? ['plan_pending_review', 'plan_ready']
        : ['code_pending_review', 'code_ready'];

    if (!validStatuses.includes(task.status)) {
      throw new BadRequestException(
        `Cannot approve ${phase} for task in '${task.status}' status. Expected one of: ${validStatuses.join(', ')}`
      );
    }

    const approvedStatus = phase === 'plan' ? 'plan_approved' : 'code_approved';

    const updated = await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: approvedStatus,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    this.logger.log(`Task ${taskId} ${phase} approved by ${reviewerId}`);

    this.agentTasksService
      .appendLog(taskId, {
        step: 'review_approved',
        message: `Phase ${phase} approved by user ${reviewerId}`,
      })
      .catch(() => {});

    return updated;
  }

  /**
   * Reject a task at the given phase.
   * For plan phase: supports iteration (re-enqueue with feedback) up to MAX_PLAN_ITERATIONS.
   * Set iterate=false to reject definitively without re-trying.
   */
  async rejectTask(
    taskId: string,
    tenantId: string,
    phase: ReviewPhase,
    reviewerId: string,
    reason?: string,
    iterate = true
  ) {
    const task = await this.prisma.agentTask.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${taskId} not found`);
    }

    const validStatuses =
      phase === 'plan'
        ? ['plan_pending_review', 'plan_ready']
        : ['code_pending_review', 'code_ready'];

    if (!validStatuses.includes(task.status)) {
      throw new BadRequestException(
        `Cannot reject ${phase} for task in '${task.status}' status. Expected one of: ${validStatuses.join(', ')}`
      );
    }

    // Plan iteration: re-enqueue for revision instead of failing
    if (phase === 'plan' && iterate && task.retryCount < MAX_PLAN_ITERATIONS) {
      const updated = await this.prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: 'analyzing',
          rejectionReason: reason || null,
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          retryCount: task.retryCount + 1,
        },
      });

      // Re-enqueue the plan generation job with the rejection feedback
      await this.agentQueue.add(
        'generate-action-plan',
        {
          type: 'generate-action-plan' as const,
          ticketId: task.ticketId,
          tenantId: task.tenantId,
          applicationId: task.applicationId,
          agentTaskId: taskId,
        },
        {
          priority: 2,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
        }
      );

      this.logger.log(
        `Task ${taskId} plan rejected by ${reviewerId} — iteration ${task.retryCount + 1}/${MAX_PLAN_ITERATIONS}: ${reason || 'no reason'}`
      );

      this.agentTasksService
        .appendLog(taskId, {
          step: 'review_rejected',
          message: `Phase ${phase} rejected: ${reason || 'no reason'} (iteration ${task.retryCount + 1}/${MAX_PLAN_ITERATIONS})`,
        })
        .catch(() => {});

      return updated;
    }

    // Definitive rejection (code phase, iterate=false, or max iterations reached)
    const updated = await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: 'failed',
        error: reason || `${phase} rejected by reviewer`,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        rejectionReason: reason || null,
        completedAt: new Date(),
      },
    });

    this.logger.log(`Task ${taskId} ${phase} rejected by ${reviewerId}: ${reason || 'no reason'}`);

    this.agentTasksService
      .appendLog(taskId, {
        step: 'review_rejected',
        message: `Phase ${phase} rejected: ${reason || 'no reason'}`,
      })
      .catch(() => {});

    return updated;
  }

  /**
   * Expire stale reviews that have been pending for more than 24 hours.
   * Called by the cron/scheduled job.
   */
  async expireStaleReviews(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

    const staleTasks = await this.prisma.agentTask.findMany({
      where: {
        status: {
          in: ['plan_pending_review', 'code_pending_review'],
        },
        reviewRequestedAt: {
          lt: cutoff,
        },
      },
    });

    if (staleTasks.length === 0) {
      return 0;
    }

    await this.prisma.agentTask.updateMany({
      where: {
        id: { in: staleTasks.map(t => t.id) },
      },
      data: {
        status: 'expired',
        error: 'Review request expired after 24 hours',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Expired ${staleTasks.length} stale review request(s)`);

    return staleTasks.length;
  }

  /**
   * List tasks pending review for a tenant.
   */
  async listPendingReviews(tenantId: string) {
    return this.prisma.agentTask.findMany({
      where: {
        tenantId,
        status: {
          in: ['plan_pending_review', 'code_pending_review'],
        },
      },
      include: {
        ticket: {
          select: {
            id: true,
            title: true,
            severity: true,
            type: true,
          },
        },
        application: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { reviewRequestedAt: 'asc' },
    });
  }
}
