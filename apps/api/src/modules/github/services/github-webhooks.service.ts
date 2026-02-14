import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { Webhooks } from '@octokit/webhooks';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface WebhookPayload {
  event: string;
  payload: any;
  signature: string;
  deliveryId: string;
}

export interface WebhookEventData {
  type: string;
  action: string;
  repository: {
    fullName: string;
    owner: string;
    name: string;
  };
  issue?: {
    number: number;
    title: string;
    state: string;
    body?: string;
    labels: string[];
  };
  pullRequest?: {
    number: number;
    title: string;
    state: string;
    merged: boolean;
    headBranch: string;
    baseBranch: string;
  };
  checkRun?: {
    name: string;
    conclusion: string | null;
    headSha: string;
    pullRequests: Array<{ number: number }>;
  };
  installation?: {
    id: number;
    accountLogin: string;
    accountType: string;
  };
  sender: {
    login: string;
    id: number;
  };
}

@Injectable()
export class GithubWebhooksService {
  private readonly logger = new Logger(GithubWebhooksService.name);
  private readonly webhooks: Webhooks | null = null;
  private readonly webhookSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @InjectQueue('github') private githubQueue: Queue,
  ) {
    this.webhookSecret = this.config.get('github.webhookSecret') || '';

    if (this.webhookSecret) {
      this.webhooks = new Webhooks({
        secret: this.webhookSecret,
      });

      this.setupEventHandlers();
    } else {
      this.logger.warn('GitHub webhook secret not configured');
    }
  }

  /**
   * Verify webhook signature
   */
  async verifySignature(
    payload: string,
    signature: string,
  ): Promise<boolean> {
    if (!this.webhooks) {
      throw new UnauthorizedException('Webhook verification not configured');
    }

    try {
      return await this.webhooks.verify(payload, signature);
    } catch {
      return false;
    }
  }

  /**
   * Process incoming webhook with event logging
   */
  async processWebhook(
    event: string,
    payload: any,
    signature: string,
    deliveryId: string,
  ): Promise<void> {
    // Verify signature
    const payloadString = JSON.stringify(payload);
    const isValid = await this.verifySignature(payloadString, signature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Processing webhook: ${event} (${deliveryId})`);

    // Log the webhook event to the database BEFORE processing
    const webhookEvent = await this.prisma.githubWebhookEvent.create({
      data: {
        installationId: payload.installation?.id
          ? BigInt(payload.installation.id)
          : null,
        eventType: event,
        action: payload.action || null,
        payload: payload as any,
        processed: false,
      },
    });

    try {
      // Extract event data
      const eventData = this.extractEventData(event, payload);

      // Queue for async processing
      await this.githubQueue.add(
        'webhook',
        {
          event,
          eventData,
          payload,
          deliveryId,
          webhookEventId: webhookEvent.id,
          receivedAt: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      // Also process synchronously for immediate sync
      await this.handleEvent(event, payload);

      // Mark webhook event as processed
      await this.prisma.githubWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true },
      });
    } catch (error) {
      // Store error on the webhook event record
      await this.prisma.githubWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: { error: error.message },
      });

      throw error;
    }
  }

  /**
   * Handle webhook event
   */
  async handleEvent(event: string, payload: any): Promise<void> {
    switch (event) {
      case 'issues':
        await this.handleIssueEvent(payload);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;
      case 'push':
        await this.handlePushEvent(payload);
        break;
      case 'issue_comment':
        await this.handleIssueCommentEvent(payload);
        break;
      case 'check_run':
        await this.handleCheckRunEvent(payload);
        break;
      case 'installation':
        await this.handleInstallationEvent(payload);
        break;
      default:
        this.logger.debug(`Unhandled webhook event: ${event}`);
    }
  }

  /**
   * Handle issue events (opened, closed, reopened, etc.)
   */
  private async handleIssueEvent(payload: any): Promise<void> {
    const { action, issue, repository } = payload;

    this.logger.log(
      `Issue ${action}: ${repository.full_name}#${issue.number}`,
    );

    // Find linked ticket
    const githubIssue = await this.prisma.githubIssue.findFirst({
      where: {
        githubRepo: repository.full_name,
        githubIssueNumber: issue.number,
      },
      include: { ticket: true },
    });

    if (!githubIssue || !githubIssue.ticketId) {
      this.logger.debug('No linked ticket found for issue');
      return;
    }

    // Bidirectional sync: Update ticket based on issue state
    switch (action) {
      case 'closed':
        await this.prisma.ticket.update({
          where: { id: githubIssue.ticketId },
          data: {
            status: 'resolved',
            resolvedAt: new Date(),
          },
        });
        this.logger.log(
          `Closed ticket ${githubIssue.ticketId} from GitHub issue`,
        );
        break;

      case 'reopened':
        await this.prisma.ticket.update({
          where: { id: githubIssue.ticketId },
          data: {
            status: 'open',
            resolvedAt: null,
          },
        });
        this.logger.log(
          `Reopened ticket ${githubIssue.ticketId} from GitHub issue`,
        );
        break;

      case 'labeled':
      case 'unlabeled':
        // Could sync labels to ticket type/severity
        await this.syncLabelsToTicket(githubIssue.ticketId, issue.labels);
        break;

      case 'edited':
        // Could sync title/body changes
        this.logger.debug('Issue edited - sync not implemented');
        break;
    }

    // Update sync status
    await this.prisma.githubIssue.update({
      where: { id: githubIssue.id },
      data: {
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Handle pull request events
   */
  private async handlePullRequestEvent(payload: any): Promise<void> {
    const { action, pull_request, repository } = payload;

    this.logger.log(
      `Pull Request ${action}: ${repository.full_name}#${pull_request.number}`,
    );

    // Check if PR references any tickets (by searching PR body for ticket IDs)
    const ticketRefs = this.extractTicketReferences(
      `${pull_request.title} ${pull_request.body || ''}`,
    );

    if (ticketRefs.length === 0) {
      return;
    }

    // If PR is merged, could auto-resolve linked tickets
    if (action === 'closed' && pull_request.merged) {
      for (const ticketId of ticketRefs) {
        try {
          await this.prisma.ticket.update({
            where: { id: ticketId },
            data: {
              status: 'resolved',
              resolvedAt: new Date(),
            },
          });
          this.logger.log(`Resolved ticket ${ticketId} from merged PR`);
        } catch (error) {
          this.logger.debug(`Could not update ticket ${ticketId}`);
        }
      }
    }
  }

  /**
   * Handle push events
   */
  private async handlePushEvent(payload: any): Promise<void> {
    const { repository, commits, ref } = payload;

    this.logger.log(
      `Push to ${repository.full_name} (${ref}): ${commits?.length || 0} commits`,
    );

    // Check commit messages for ticket references
    if (!commits) return;

    for (const commit of commits) {
      const ticketRefs = this.extractTicketReferences(commit.message);

      for (const ticketId of ticketRefs) {
        // Add a note about the commit to the ticket
        this.logger.debug(
          `Commit ${commit.id.slice(0, 7)} references ticket ${ticketId}`,
        );
        // Could add comment to ticket or update metadata
      }
    }
  }

  /**
   * Handle issue comment events
   */
  private async handleIssueCommentEvent(payload: any): Promise<void> {
    const { action, issue, comment, repository } = payload;

    if (action !== 'created') {
      return;
    }

    this.logger.log(
      `Comment on ${repository.full_name}#${issue.number} by ${comment.user.login}`,
    );

    // Find linked ticket
    const githubIssue = await this.prisma.githubIssue.findFirst({
      where: {
        githubRepo: repository.full_name,
        githubIssueNumber: issue.number,
      },
    });

    if (!githubIssue || !githubIssue.ticketId) {
      return;
    }

    // Could create a message/comment on the ticket
    // Implementation depends on ticket comment system
  }

  /**
   * Handle check_run events (CI status feedback)
   */
  private async handleCheckRunEvent(payload: any): Promise<void> {
    const { action, check_run, repository } = payload;

    this.logger.log(
      `Check run ${action}: ${check_run.name} on ${repository.full_name} - ${check_run.conclusion || 'in_progress'}`,
    );

    // Only process completed check runs
    if (action !== 'completed') {
      return;
    }

    const { conclusion, head_sha, pull_requests } = check_run;

    // On failure, find related PR -> ticket for future CI feedback (US-4.3)
    if (conclusion === 'failure') {
      for (const pr of pull_requests || []) {
        const ticketRefs = await this.findTicketsForPR(
          repository.full_name,
          pr.number,
        );
        for (const ticketId of ticketRefs) {
          this.logger.log(
            `CI failure for check "${check_run.name}" (sha: ${head_sha.slice(0, 7)}) linked to ticket ${ticketId}`,
          );
        }
      }
    }
  }

  /**
   * Handle installation events (lifecycle management)
   */
  private async handleInstallationEvent(payload: any): Promise<void> {
    const { action, installation, sender } = payload;
    const installationId = BigInt(installation.id);

    this.logger.log(
      `Installation ${action}: ${installation.account.login} (ID: ${installation.id})`,
    );

    switch (action) {
      case 'created': {
        // Check if installation already exists (idempotency)
        const existing =
          await this.prisma.githubInstallation.findUnique({
            where: { installationId },
          });

        if (!existing) {
          // Note: tenantId mapping handled later (US-1.2 installation flow).
          // For now, we only log the event. The actual GithubInstallation record
          // will be created during the installation callback flow when we know
          // which tenant it belongs to.
          this.logger.log(
            `New GitHub App installation ${installation.id} by ${sender.login} (account: ${installation.account.login}, type: ${installation.account.type}). Tenant mapping will be handled during installation flow.`,
          );
        }
        break;
      }

      case 'deleted': {
        // Remove the installation record if it exists
        try {
          await this.prisma.githubInstallation.delete({
            where: { installationId },
          });
          this.logger.log(
            `Deleted installation record for ${installation.id}`,
          );
        } catch {
          // Record may not exist yet (no tenant mapping)
          this.logger.debug(
            `No installation record found for ${installation.id} to delete`,
          );
        }
        break;
      }

      case 'suspend': {
        try {
          await this.prisma.githubInstallation.update({
            where: { installationId },
            data: { suspendedAt: new Date() },
          });
          this.logger.log(`Suspended installation ${installation.id}`);
        } catch {
          this.logger.debug(
            `No installation record found for ${installation.id} to suspend`,
          );
        }
        break;
      }

      case 'unsuspend': {
        try {
          await this.prisma.githubInstallation.update({
            where: { installationId },
            data: { suspendedAt: null },
          });
          this.logger.log(`Unsuspended installation ${installation.id}`);
        } catch {
          this.logger.debug(
            `No installation record found for ${installation.id} to unsuspend`,
          );
        }
        break;
      }

      default:
        this.logger.debug(
          `Unhandled installation action: ${action}`,
        );
    }
  }

  /**
   * Find tickets linked to a PR by PR number
   */
  private async findTicketsForPR(
    repoFullName: string,
    prNumber: number,
  ): Promise<string[]> {
    // GitHub issues and PRs share the same number space,
    // but our GithubIssue model tracks issues. For now, check
    // if there's a linked issue with that number.
    const githubIssue = await this.prisma.githubIssue.findFirst({
      where: {
        githubRepo: repoFullName,
        githubIssueNumber: prNumber,
      },
    });

    if (githubIssue?.ticketId) {
      return [githubIssue.ticketId];
    }

    return [];
  }

  /**
   * Sync GitHub labels to ticket type/severity
   */
  private async syncLabelsToTicket(
    ticketId: string,
    labels: Array<{ name: string }>,
  ): Promise<void> {
    const updates: any = {};

    for (const label of labels) {
      if (label.name.startsWith('type:')) {
        updates.type = label.name.replace('type:', '');
      }
      if (label.name.startsWith('severity:')) {
        updates.severity = label.name.replace('severity:', '');
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: updates,
      });
    }
  }

  /**
   * Extract ticket ID references from text
   * Looks for patterns like "ticket-abc123", "#abc123", or UUIDs
   */
  private extractTicketReferences(text: string): string[] {
    const refs: string[] = [];

    // Match ticket-XXXXX pattern
    const ticketPattern = /ticket[- ]([a-f0-9]{8})/gi;
    let match;
    while ((match = ticketPattern.exec(text)) !== null) {
      refs.push(match[1]);
    }

    // Match full UUIDs
    const uuidPattern =
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
    while ((match = uuidPattern.exec(text)) !== null) {
      refs.push(match[0]);
    }

    return [...new Set(refs)];
  }

  /**
   * Extract standardized event data from webhook payload
   */
  private extractEventData(event: string, payload: any): WebhookEventData {
    const data: WebhookEventData = {
      type: event,
      action: payload.action || 'unknown',
      repository: {
        fullName: payload.repository?.full_name || '',
        owner: payload.repository?.owner?.login || '',
        name: payload.repository?.name || '',
      },
      sender: {
        login: payload.sender?.login || 'unknown',
        id: payload.sender?.id || 0,
      },
    };

    if (payload.issue) {
      data.issue = {
        number: payload.issue.number,
        title: payload.issue.title,
        state: payload.issue.state,
        body: payload.issue.body,
        labels: payload.issue.labels?.map((l: any) => l.name) || [],
      };
    }

    if (payload.pull_request) {
      data.pullRequest = {
        number: payload.pull_request.number,
        title: payload.pull_request.title,
        state: payload.pull_request.state,
        merged: payload.pull_request.merged || false,
        headBranch: payload.pull_request.head?.ref || '',
        baseBranch: payload.pull_request.base?.ref || '',
      };
    }

    if (payload.check_run) {
      data.checkRun = {
        name: payload.check_run.name,
        conclusion: payload.check_run.conclusion || null,
        headSha: payload.check_run.head_sha,
        pullRequests:
          payload.check_run.pull_requests?.map((pr: any) => ({
            number: pr.number,
          })) || [],
      };
    }

    if (payload.installation && event === 'installation') {
      data.installation = {
        id: payload.installation.id,
        accountLogin: payload.installation.account?.login || '',
        accountType: payload.installation.account?.type || '',
      };
    }

    return data;
  }

  /**
   * Delete webhook events older than the specified number of days
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.githubWebhookEvent.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    this.logger.log(
      `Cleaned up ${result.count} webhook events older than ${olderThanDays} days`,
    );

    return result.count;
  }

  /**
   * Setup Octokit webhook event handlers
   */
  private setupEventHandlers(): void {
    if (!this.webhooks) return;

    this.webhooks.on('issues', async ({ payload }) => {
      await this.handleIssueEvent(payload);
    });

    this.webhooks.on('pull_request', async ({ payload }) => {
      await this.handlePullRequestEvent(payload);
    });

    this.webhooks.on('push', async ({ payload }) => {
      await this.handlePushEvent(payload);
    });

    this.webhooks.on('issue_comment', async ({ payload }) => {
      await this.handleIssueCommentEvent(payload);
    });
  }
}
