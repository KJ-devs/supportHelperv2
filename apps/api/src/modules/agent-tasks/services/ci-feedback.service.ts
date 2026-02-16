import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';

const MAX_CI_RETRIES = 3;

@Injectable()
export class CIFeedbackService {
  private readonly logger = new Logger(CIFeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('agent-orchestration')
    private readonly agentQueue: Queue,
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
      return { handled: true, action: 'escalated' };
    }

    // 3. Build CI error context
    const ciErrorLog = [
      `CI Check "${params.checkName}" failed (conclusion: ${params.conclusion})`,
      `Commit SHA: ${params.headSha}`,
      `Attempt: ${agentTask.retryCount + 1}/${MAX_CI_RETRIES}`,
    ].join('\n');

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
}
