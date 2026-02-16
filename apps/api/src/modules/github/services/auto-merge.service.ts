import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubAppService } from './github-app.service';
import { TicketTimelineService } from '../../tickets/services/ticket-timeline.service';
import { AutoResponseService } from '../../tickets/services/auto-response.service';

export interface MergeResult {
  merged: boolean;
  reason?: string;
}

@Injectable()
export class AutoMergeService {
  private readonly logger = new Logger(AutoMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAppService: GithubAppService,
    private readonly ticketTimelineService: TicketTimelineService,
    @Optional()
    @Inject(AutoResponseService)
    private readonly autoResponseService?: AutoResponseService,
  ) {}

  /**
   * Check merge conditions and merge if all met.
   * Called when: review approved, check_run succeeded, or PR updated.
   */
  async checkAndMerge(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<MergeResult> {
    // 1. Find ProjectGithubConfig for owner/repo
    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { owner, repo },
      include: { installation: true },
    });

    if (!config) {
      return { merged: false, reason: 'no_config' };
    }

    // 2. Check settings.auto_merge_enabled
    const settings = (config.settings as { auto_merge_enabled?: boolean } | null) || {};
    if (!settings.auto_merge_enabled) {
      return { merged: false, reason: 'disabled' };
    }

    // 3. Get installation Octokit via GithubAppService
    const octokit = await this.githubAppService.getInstallationOctokit(
      Number(config.installationId),
    );

    // 4. Fetch PR details
    let pr: any;
    try {
      const { data } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      pr = data;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch PR ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : error}`,
      );
      return { merged: false, reason: 'pr_fetch_failed' };
    }

    // Skip if PR is already merged or closed
    if (pr.merged) {
      return { merged: false, reason: 'already_merged' };
    }
    if (pr.state !== 'open') {
      return { merged: false, reason: 'not_open' };
    }

    // 4a. Check mergeable state (no conflicts)
    if (pr.mergeable === false) {
      await this.recordConflictEvent(owner, repo, prNumber, config);
      return { merged: false, reason: 'merge_conflict' };
    }

    // 4b. Check approved reviews
    const requiredApprovals = settings.required_approvals || 1;
    try {
      const { data: reviews } = await octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber,
      });

      const approvals = reviews.filter(
        (r: any) => r.state === 'APPROVED',
      ).length;

      if (approvals < requiredApprovals) {
        return {
          merged: false,
          reason: `insufficient_approvals (${approvals}/${requiredApprovals})`,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check reviews for ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : error}`,
      );
      return { merged: false, reason: 'review_check_failed' };
    }

    // 4c. Check required status checks
    try {
      const { data: combined } = await octokit.repos.getCombinedStatusForRef({
        owner,
        repo,
        ref: pr.head.sha,
      });

      // If there are status checks and they're not all successful, don't merge
      if (combined.total_count > 0 && combined.state !== 'success') {
        return {
          merged: false,
          reason: `checks_not_passing (state: ${combined.state})`,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check status for ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : error}`,
      );
      // Don't block merge if status check API fails — proceed cautiously
    }

    // 5. All conditions met — merge
    const mergeStrategy = (settings.merge_strategy || 'squash') as 'squash' | 'merge' | 'rebase';
    try {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: mergeStrategy,
      });

      this.logger.log(
        `Auto-merged PR ${owner}/${repo}#${prNumber} with strategy: ${mergeStrategy}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to merge PR ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : error}`,
      );
      return { merged: false, reason: 'merge_failed' };
    }

    // 5b. Delete the branch
    const branchName = pr.head.ref;
    try {
      await octokit.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      this.logger.log(`Deleted branch ${branchName} after merge`);
    } catch (error) {
      // Non-fatal — branch may already be deleted or protected
      this.logger.warn(
        `Failed to delete branch ${branchName}: ${error instanceof Error ? error.message : error}`,
      );
    }

    // 5c-e. Update linked AgentTask, ticket status, and record timeline event
    await this.updateLinkedEntities(
      owner,
      repo,
      prNumber,
      branchName,
      config,
    );

    return { merged: true };
  }

  /**
   * Handle a PR that was merged (externally or by us).
   * Updates ticket + agent task status.
   */
  async handlePRMerged(
    owner: string,
    repo: string,
    prNumber: number,
    mergedBy?: string,
  ): Promise<void> {
    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { owner, repo },
      include: { installation: true },
    });

    if (!config) {
      this.logger.debug(
        `No ProjectGithubConfig for ${owner}/${repo}, skipping PR merged handling`,
      );
      return;
    }

    // Find AgentTask by prNumber
    const agentTask = await this.prisma.agentTask.findFirst({
      where: {
        prNumber,
        tenantId: config.installation.tenantId,
      },
      include: { ticket: true },
    });

    if (!agentTask) {
      this.logger.debug(
        `No AgentTask found for PR ${owner}/${repo}#${prNumber}`,
      );
      return;
    }

    // Update task status to merged
    await this.prisma.agentTask.update({
      where: { id: agentTask.id },
      data: {
        status: 'merged',
        completedAt: new Date(),
      },
    });

    // Update ticket status to merged
    await this.prisma.ticket.update({
      where: { id: agentTask.ticketId },
      data: { status: 'merged' },
    });

    // Record timeline event
    await this.ticketTimelineService.recordEvent(
      agentTask.ticketId,
      agentTask.tenantId,
      'pr_merged',
      {
        prNumber,
        owner,
        repo,
        mergedBy: mergedBy || 'unknown',
        prUrl: agentTask.prUrl,
        branchName: agentTask.branchName,
      },
    );

    // Trigger auto-response to client
    if (this.autoResponseService) {
      await this.autoResponseService.handleTicketMerged(
        agentTask.ticketId,
        agentTask.tenantId,
        {
          prNumber,
          prUrl: agentTask.prUrl,
          branchName: agentTask.branchName,
        },
      );
    }

    this.logger.log(
      `Handled PR merged: ${owner}/${repo}#${prNumber} — ticket ${agentTask.ticketId} updated to merged`,
    );
  }

  /**
   * After a successful auto-merge, update linked AgentTask and Ticket.
   */
  private async updateLinkedEntities(
    owner: string,
    repo: string,
    prNumber: number,
    branchName: string,
    config: any,
  ): Promise<void> {
    const tenantId = config.installation.tenantId;

    // Find linked AgentTask by branchName or prNumber
    const agentTask = await this.prisma.agentTask.findFirst({
      where: {
        tenantId,
        OR: [{ prNumber }, { branchName }],
      },
      include: { ticket: true },
    });

    if (!agentTask) {
      this.logger.debug(
        `No AgentTask linked to PR ${owner}/${repo}#${prNumber} or branch ${branchName}`,
      );
      return;
    }

    // Update task status
    await this.prisma.agentTask.update({
      where: { id: agentTask.id },
      data: {
        status: 'merged',
        completedAt: new Date(),
      },
    });

    // Update ticket status
    await this.prisma.ticket.update({
      where: { id: agentTask.ticketId },
      data: { status: 'merged' },
    });

    // Record timeline event
    await this.ticketTimelineService.recordEvent(
      agentTask.ticketId,
      tenantId,
      'pr_merged',
      {
        prNumber,
        owner,
        repo,
        autoMerged: true,
        branchName,
        prUrl: agentTask.prUrl,
      },
    );

    // Trigger auto-response to client
    if (this.autoResponseService) {
      await this.autoResponseService.handleTicketMerged(
        agentTask.ticketId,
        tenantId,
        {
          prNumber,
          prUrl: agentTask.prUrl,
          branchName,
        },
      );
    }

    this.logger.log(
      `Updated AgentTask ${agentTask.id} and ticket ${agentTask.ticketId} to merged`,
    );
  }

  /**
   * Record a merge conflict timeline event for the linked ticket.
   */
  private async recordConflictEvent(
    owner: string,
    repo: string,
    prNumber: number,
    config: any,
  ): Promise<void> {
    const tenantId = config.installation.tenantId;

    const agentTask = await this.prisma.agentTask.findFirst({
      where: {
        tenantId,
        prNumber,
      },
      include: { ticket: true },
    });

    if (!agentTask) return;

    await this.ticketTimelineService.recordEvent(
      agentTask.ticketId,
      tenantId,
      'merge_conflict',
      {
        prNumber,
        owner,
        repo,
        prUrl: agentTask.prUrl,
      },
    );

    this.logger.warn(
      `Merge conflict detected for PR ${owner}/${repo}#${prNumber} (ticket: ${agentTask.ticketId})`,
    );
  }
}
