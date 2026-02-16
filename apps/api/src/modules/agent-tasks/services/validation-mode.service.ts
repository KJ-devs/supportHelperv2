import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentMode, ReviewPhase } from '../types/action-plan.types';

@Injectable()
export class ValidationModeService {
  private readonly logger = new Logger(ValidationModeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the agent mode for a given application (project).
   * Reads from ProjectGithubConfig.settings.agentMode.
   * Defaults to 'auto' if not set.
   */
  async getAgentMode(applicationId: string): Promise<AgentMode> {
    const config = await this.prisma.projectGithubConfig.findUnique({
      where: { applicationId },
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
  async shouldWaitForReview(
    applicationId: string,
    phase: ReviewPhase,
  ): Promise<boolean> {
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

    const pendingStatus =
      phase === 'plan' ? 'plan_pending_review' : 'code_pending_review';

    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: pendingStatus,
        reviewRequestedAt: new Date(),
      },
    });

    this.logger.log(
      `Review requested for task ${taskId} (phase: ${phase})`,
    );
  }

  /**
   * Approve a task at the given phase.
   * Returns the updated task.
   */
  async approveTask(
    taskId: string,
    tenantId: string,
    phase: ReviewPhase,
    reviewerId: string,
  ) {
    const task = await this.prisma.agentTask.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Agent task ${taskId} not found`);
    }

    const expectedStatus =
      phase === 'plan' ? 'plan_pending_review' : 'code_pending_review';

    // Also allow approving from plan_ready / code_ready for backward compat
    const validStatuses =
      phase === 'plan'
        ? ['plan_pending_review', 'plan_ready']
        : ['code_pending_review', 'code_ready'];

    if (!validStatuses.includes(task.status)) {
      throw new BadRequestException(
        `Cannot approve ${phase} for task in '${task.status}' status. Expected one of: ${validStatuses.join(', ')}`,
      );
    }

    const approvedStatus =
      phase === 'plan' ? 'plan_approved' : 'code_approved';

    const updated = await this.prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: approvedStatus,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    this.logger.log(
      `Task ${taskId} ${phase} approved by ${reviewerId}`,
    );

    return updated;
  }

  /**
   * Reject a task at the given phase.
   */
  async rejectTask(
    taskId: string,
    tenantId: string,
    phase: ReviewPhase,
    reviewerId: string,
    reason?: string,
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
        `Cannot reject ${phase} for task in '${task.status}' status. Expected one of: ${validStatuses.join(', ')}`,
      );
    }

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

    this.logger.log(
      `Task ${taskId} ${phase} rejected by ${reviewerId}: ${reason || 'no reason'}`,
    );

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
        id: { in: staleTasks.map((t) => t.id) },
      },
      data: {
        status: 'expired',
        error: 'Review request expired after 24 hours',
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Expired ${staleTasks.length} stale review request(s)`,
    );

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
