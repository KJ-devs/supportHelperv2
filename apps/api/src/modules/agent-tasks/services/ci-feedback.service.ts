import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

const MAX_CI_RETRIES = 3;

@Injectable()
export class CIFeedbackService {
  private readonly logger = new Logger(CIFeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('agent-orchestration')
    private readonly agentQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle CI failure for an agent-generated PR.
   * Finds the AgentTask by branch name, increments retry count,
   * and re-queues code generation with CI error context.
   */
  async handleCIFailure(params: {
    owner: string;
    repo: string;
    branchName: string;
    checkName: string;
    conclusion: string;
    headSha: string;
    checkRunId?: number;
    annotations?: Array<{
      path: string;
      startLine: number;
      endLine: number;
      annotationLevel: string;
      message: string;
    }>;
  }): Promise<{ handled: boolean; action?: string }> {
    // 1. Find AgentTask by branchName with status 'pr_created'
    const agentTask = await this.prisma.agentTask.findFirst({
      where: {
        branchName: params.branchName,
        status: { in: ['pr_created', 'completed'] },
      },
    });

    if (!agentTask) {
      this.logger.debug(`No agent task found for branch ${params.branchName}`);
      return { handled: false };
    }

    // Emit CI failure event for WebSocket consumers
    this.eventEmitter.emit('agent-task:ci-status', {
      taskId: agentTask.id,
      status: 'failure',
      details: `Check "${params.checkName}" failed (${params.conclusion})`,
      checkRunId: params.checkRunId,
    });

    // 2. Check retry limit
    if (agentTask.retryCount >= MAX_CI_RETRIES) {
      this.logger.warn(
        `Agent task ${agentTask.id} exceeded max CI retries (${MAX_CI_RETRIES}). Escalating.`,
      );
      await this.prisma.agentTask.update({
        where: { id: agentTask.id },
        data: {
          status: 'failed',
          error: `CI failed ${MAX_CI_RETRIES} times for check "${params.checkName}". Manual intervention required.`,
        },
      });

      this.eventEmitter.emit('agent-task:status-changed', {
        taskId: agentTask.id,
        previousStatus: 'pr_created',
        newStatus: 'failed',
        metadata: { reason: 'ci_max_retries' },
      });

      return { handled: true, action: 'escalated' };
    }

    // 3. Build CI error context with annotations if available
    const ciErrorParts = [
      `CI Check "${params.checkName}" failed (conclusion: ${params.conclusion})`,
      `Commit SHA: ${params.headSha}`,
      `Attempt: ${agentTask.retryCount + 1}/${MAX_CI_RETRIES}`,
    ];

    if (params.annotations && params.annotations.length > 0) {
      ciErrorParts.push('', '--- Annotations ---');
      for (const ann of params.annotations) {
        ciErrorParts.push(
          `[${ann.annotationLevel}] ${ann.path}:${ann.startLine}-${ann.endLine}: ${ann.message}`,
        );
      }
    }

    const ciErrorLog = ciErrorParts.join('\n');

    // 4. Update task: increment retry, store error, reset status, and append to execution log
    type ExecutionLogEntry = {
      step: string;
      message: string;
      attempt?: number;
      timestamp: string;
    };
    const currentLog = (agentTask.executionLog as ExecutionLogEntry[]) || [];
    await this.prisma.agentTask.update({
      where: { id: agentTask.id },
      data: {
        retryCount: { increment: 1 },
        ciErrorLog,
        status: 'generating',
        executionLog: [
          ...currentLog,
          {
            step: 'ci_retry',
            message: `Re-generating after CI failure: ${params.checkName}`,
            attempt: agentTask.retryCount + 1,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    // 5. Re-queue code generation
    await this.agentQueue.add(
      'generate-code',
      {
        type: 'generate-code' as const,
        ticketId: agentTask.ticketId,
        tenantId: agentTask.tenantId,
        applicationId: agentTask.applicationId,
        agentTaskId: agentTask.id,
      },
      {
        priority: 3, // Higher priority for retries
        attempts: 1,
      },
    );

    this.logger.log(
      `Re-queued code generation for task ${agentTask.id} (retry ${agentTask.retryCount + 1}/${MAX_CI_RETRIES})`,
    );

    return { handled: true, action: 'retrying' };
  }

  /**
   * Handle CI success for an agent-generated PR.
   * Updates the AgentTask to 'completed' and emits WebSocket events.
   */
  async handleCISuccess(params: {
    branchName: string;
    checkName: string;
  }): Promise<{ handled: boolean }> {
    const agentTask = await this.prisma.agentTask.findFirst({
      where: {
        branchName: params.branchName,
        status: 'pr_created',
      },
    });

    if (!agentTask) {
      return { handled: false };
    }

    await this.prisma.agentTask.update({
      where: { id: agentTask.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    this.eventEmitter.emit('agent-task:ci-status', {
      taskId: agentTask.id,
      status: 'success',
      details: `Check "${params.checkName}" passed`,
    });

    this.eventEmitter.emit('agent-task:status-changed', {
      taskId: agentTask.id,
      previousStatus: 'pr_created',
      newStatus: 'completed',
    });

    this.logger.log(
      `Agent task ${agentTask.id} completed after CI success on branch ${params.branchName}`,
    );

    return { handled: true };
  }
}
