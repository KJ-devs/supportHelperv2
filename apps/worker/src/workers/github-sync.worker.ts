import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import {
  GithubSyncJobData,
  GithubSyncResult,
  GithubSyncIssuesPayload,
  GithubCreateIssuePayload,
  GithubUpdateIssuePayload,
  GithubWebhookPayload,
  GithubSyncRepoPayload,
} from '../queues/queue.types';
import { GithubService } from '../services/github.service';
import { PrismaService } from '../services/prisma.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

/**
 * GithubSyncWorker
 *
 * BullMQ consumer for GitHub synchronization:
 * - Sync issues bidirectional
 * - Webhooks processing
 * - Create/update issues from tickets
 */
@Processor(QUEUE_NAMES.GITHUB_SYNC, {
  concurrency: 10,
  limiter: {
    max: 100,
    duration: 60000,
  },
})
export class GithubSyncWorker extends WorkerHost {
  private readonly logger = new Logger(GithubSyncWorker.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly prisma: PrismaService
  ) {
    super();
  }

  /**
   * Main processor method - routes to specific handlers based on job type
   */
  async process(job: Job<GithubSyncJobData>): Promise<GithubSyncResult> {
    const { type, connectionId, payload } = job.data;

    this.logger.log(`Processing GitHub sync job ${job.id} of type: ${type}`);

    try {
      // Get GitHub connection
      const connection = await this.prisma.githubConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        throw new Error(`GitHub connection ${connectionId} not found`);
      }

      // Initialize GitHub client with connection
      await this.githubService.initialize(connection);

      // Route to appropriate handler
      switch (type) {
        case 'sync-issues':
          return await this.handleSyncIssues(job, payload as GithubSyncIssuesPayload);

        case 'create-issue':
          return await this.handleCreateIssue(job, payload as GithubCreateIssuePayload);

        case 'update-issue':
          return await this.handleUpdateIssue(job, payload as GithubUpdateIssuePayload);

        case 'webhook-event':
          return await this.handleWebhookEvent(job, payload as GithubWebhookPayload);

        case 'sync-repository':
          return await this.handleSyncRepository(job, payload as GithubSyncRepoPayload);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`GitHub sync failed: ${getErrorMessage(error)}`, getErrorStack(error));
      return {
        success: false,
        type,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Sync issues from GitHub to local database
   */
  private async handleSyncIssues(
    job: Job<GithubSyncJobData>,
    payload: GithubSyncIssuesPayload
  ): Promise<GithubSyncResult> {
    const { repo, since, state = 'all' } = payload;

    this.logger.log(`Syncing issues from ${repo} (state: ${state})`);
    await job.updateProgress(10);

    // Fetch issues from GitHub
    const issues = await this.githubService.listIssues(repo, {
      state,
      since,
      per_page: 100,
    });

    await job.updateProgress(50);

    let processed = 0;
    for (const issue of issues) {
      // Find or create linked ticket
      const existingLink = await this.prisma.githubIssue.findFirst({
        where: {
          githubRepo: repo,
          githubIssueNumber: issue.number,
        },
      });

      if (existingLink) {
        // Update existing link
        await this.prisma.githubIssue.update({
          where: { id: existingLink.id },
          data: {
            syncStatus: issue.state,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        // Check if we should create a new ticket or just log
        this.logger.debug(`New issue found: #${issue.number} - ${issue.title}`);
      }

      processed++;
      await job.updateProgress(50 + Math.floor((processed / issues.length) * 50));
    }

    this.logger.log(`Synced ${processed} issues from ${repo}`);

    return {
      success: true,
      type: 'sync-issues',
      itemsProcessed: processed,
    };
  }

  /**
   * Create a GitHub issue from a ticket
   */
  private async handleCreateIssue(
    job: Job<GithubSyncJobData>,
    payload: GithubCreateIssuePayload
  ): Promise<GithubSyncResult> {
    const { ticketId, repo, title, body, labels } = payload;

    this.logger.log(`Creating GitHub issue for ticket ${ticketId} in ${repo}`);
    await job.updateProgress(20);

    // Get ticket details
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        media: true,
        application: true,
      },
    });

    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    // Build issue body with context
    const issueBody = this.buildIssueBody(ticket, body);

    await job.updateProgress(40);

    // Create issue on GitHub
    const issue = await this.githubService.createIssue(repo, {
      title,
      body: issueBody,
      labels: labels || this.getLabelsForTicket(ticket),
    });

    await job.updateProgress(70);

    // Store link in database
    await this.prisma.githubIssue.create({
      data: {
        ticketId,
        githubRepo: repo,
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.html_url,
        syncStatus: issue.state,
        lastSyncedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    this.logger.log(`Created GitHub issue #${issue.number} for ticket ${ticketId}`);

    return {
      success: true,
      type: 'create-issue',
      issueNumber: issue.number,
    };
  }

  /**
   * Update an existing GitHub issue
   */
  private async handleUpdateIssue(
    job: Job<GithubSyncJobData>,
    payload: GithubUpdateIssuePayload
  ): Promise<GithubSyncResult> {
    const { ticketId, issueNumber, repo, updates } = payload;

    this.logger.log(`Updating GitHub issue #${issueNumber} in ${repo}`);
    await job.updateProgress(20);

    // Update on GitHub
    const issue = await this.githubService.updateIssue(repo, issueNumber, updates);

    await job.updateProgress(70);

    // Update local link
    await this.prisma.githubIssue.updateMany({
      where: {
        ticketId,
        githubRepo: repo,
        githubIssueNumber: issueNumber,
      },
      data: {
        syncStatus: issue.state,
        lastSyncedAt: new Date(),
      },
    });

    await job.updateProgress(100);

    this.logger.log(`Updated GitHub issue #${issueNumber}`);

    return {
      success: true,
      type: 'update-issue',
      issueNumber,
    };
  }

  /**
   * Process webhook events from GitHub
   */
  private async handleWebhookEvent(
    job: Job<GithubSyncJobData>,
    payload: GithubWebhookPayload
  ): Promise<GithubSyncResult> {
    const { event, action, data } = payload;
    const { tenantId } = job.data;

    this.logger.log(`Processing webhook: ${event}.${action}`);
    await job.updateProgress(10);

    let processed = 0;

    switch (event) {
      case 'issues':
        processed = await this.processIssueWebhook(action, data, tenantId);
        break;

      case 'issue_comment':
        processed = await this.processCommentWebhook(action, data, tenantId);
        break;

      case 'pull_request':
        processed = await this.processPRWebhook(action, data, tenantId);
        break;

      case 'push':
        processed = await this.processPushWebhook(data, tenantId);
        break;

      default:
        this.logger.debug(`Unhandled webhook event: ${event}`);
    }

    await job.updateProgress(100);

    return {
      success: true,
      type: 'webhook-event',
      itemsProcessed: processed,
    };
  }

  /**
   * Full repository sync
   */
  private async handleSyncRepository(
    job: Job<GithubSyncJobData>,
    payload: GithubSyncRepoPayload
  ): Promise<GithubSyncResult> {
    const { repo, fullSync } = payload;
    const { tenantId } = job.data;

    this.logger.log(`Full sync for repository ${repo}`);
    await job.updateProgress(10);

    // Sync open issues
    const openIssues = await this.githubService.listIssues(repo, {
      state: 'open',
      per_page: 100,
    });

    await job.updateProgress(30);

    // Sync closed issues if full sync
    let closedIssues: any[] = [];
    if (fullSync) {
      closedIssues = await this.githubService.listIssues(repo, {
        state: 'closed',
        per_page: 100,
      });
    }

    await job.updateProgress(50);

    const allIssues = [...openIssues, ...closedIssues];
    let processed = 0;

    for (const issue of allIssues) {
      await this.syncSingleIssue(repo, issue, tenantId);
      processed++;
      await job.updateProgress(50 + Math.floor((processed / allIssues.length) * 50));
    }

    this.logger.log(`Repository sync completed: ${processed} issues`);

    return {
      success: true,
      type: 'sync-repository',
      itemsProcessed: processed,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═══════════════════════════════════════════════════════════════════════

  private buildIssueBody(ticket: any, customBody: string): string {
    const parts: string[] = [];

    // Custom body first
    parts.push(customBody);

    // AI Summary
    if (ticket.aiSummary) {
      parts.push('\n## AI Analysis\n');
      parts.push(ticket.aiSummary);
    }

    // Reproduction steps
    if (ticket.reproductionSteps) {
      parts.push('\n## Reproduction Steps\n');
      const steps = Array.isArray(ticket.reproductionSteps)
        ? ticket.reproductionSteps
        : [ticket.reproductionSteps];
      steps.forEach((step: string, index: number) => {
        parts.push(`${index + 1}. ${step}`);
      });
    }

    // Environment info
    if (ticket.userContext) {
      parts.push('\n## Environment\n');
      parts.push('```json');
      parts.push(JSON.stringify(ticket.userContext, null, 2));
      parts.push('```');
    }

    // Link back to support helper
    parts.push('\n---\n');
    parts.push(`*Created from Support Helper ticket: \`${ticket.id}\`*`);

    return parts.join('\n');
  }

  private getLabelsForTicket(ticket: any): string[] {
    const labels: string[] = [];

    if (ticket.type) {
      labels.push(`type:${ticket.type}`);
    }

    if (ticket.severity) {
      labels.push(`severity:${ticket.severity}`);
    }

    labels.push('support-helper');

    return labels;
  }

  private async processIssueWebhook(action: string, data: any, _tenantId: string): Promise<number> {
    const issue = data.issue;
    const repo = data.repository?.full_name;

    if (!issue || !repo) return 0;

    // Find linked ticket
    const link = await this.prisma.githubIssue.findFirst({
      where: {
        githubRepo: repo,
        githubIssueNumber: issue.number,
      },
      include: { ticket: true },
    });

    if (!link) return 0;

    // Update ticket based on action
    if (action === 'closed') {
      await this.prisma.ticket.update({
        where: { id: link.ticketId! },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
        },
      });
    } else if (action === 'reopened') {
      await this.prisma.ticket.update({
        where: { id: link.ticketId! },
        data: {
          status: 'open',
          resolvedAt: null,
        },
      });
    }

    // Update link status
    await this.prisma.githubIssue.update({
      where: { id: link.id },
      data: {
        syncStatus: issue.state,
        lastSyncedAt: new Date(),
      },
    });

    return 1;
  }

  private async processCommentWebhook(
    action: string,
    data: any,
    _tenantId: string
  ): Promise<number> {
    // Handle issue comments - could create ticket comments
    this.logger.debug(`Comment ${action} on issue #${data.issue?.number}`);
    return 1;
  }

  private async processPRWebhook(action: string, data: any, _tenantId: string): Promise<number> {
    // Handle PR events - could link to tickets via commit messages
    this.logger.debug(`PR ${action}: #${data.pull_request?.number}`);
    return 1;
  }

  private async processPushWebhook(data: any, _tenantId: string): Promise<number> {
    // Handle push events - could trigger git blame analysis
    this.logger.debug(`Push to ${data.ref} with ${data.commits?.length || 0} commits`);
    return data.commits?.length || 0;
  }

  private async syncSingleIssue(repo: string, issue: any, _tenantId: string): Promise<void> {
    const existingLink = await this.prisma.githubIssue.findFirst({
      where: {
        githubRepo: repo,
        githubIssueNumber: issue.number,
      },
    });

    if (existingLink) {
      await this.prisma.githubIssue.update({
        where: { id: existingLink.id },
        data: {
          syncStatus: issue.state,
          githubIssueUrl: issue.html_url,
          lastSyncedAt: new Date(),
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════



}
