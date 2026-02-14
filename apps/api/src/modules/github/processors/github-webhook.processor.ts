import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubIssuesService } from '../services/github-issues.service';

export interface GithubWebhookJobData {
  event: string;
  eventData: any;
  payload: any;
  deliveryId: string;
  webhookEventId?: string;
  receivedAt: string;
}

export interface CreateGithubIssueJobData {
  ticketId: string;
}

export interface SyncTicketStatusJobData {
  ticketId: string;
  newStatus: string;
}

@Processor('github')
export class GithubWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(GithubWebhookProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issuesService: GithubIssuesService,
  ) {
    super();
  }

  async process(job: Job<GithubWebhookJobData | CreateGithubIssueJobData | SyncTicketStatusJobData>): Promise<any> {
    // Handle create-github-issue jobs
    if (job.name === 'create-github-issue') {
      const data = job.data as CreateGithubIssueJobData;
      this.logger.log(`Processing create-github-issue job for ticket ${data.ticketId}`);
      await this.issuesService.autoCreateIssueFromTicket(data.ticketId);
      return { handled: true, ticketId: data.ticketId };
    }

    // Handle sync-ticket-status jobs (reverse sync: ticket -> GitHub)
    if (job.name === 'sync-ticket-status') {
      const data = job.data as SyncTicketStatusJobData;
      this.logger.log(`Processing sync-ticket-status job for ticket ${data.ticketId} (status: ${data.newStatus})`);
      await this.issuesService.syncTicketStatusToGithub(data.ticketId, data.newStatus);
      return { handled: true, ticketId: data.ticketId, newStatus: data.newStatus };
    }

    // Handle webhook jobs
    const webhookData = job.data as GithubWebhookJobData;
    const { event, deliveryId } = webhookData;

    this.logger.log(`Processing GitHub webhook job: ${event} (${deliveryId})`);

    try {
      switch (event) {
        case 'issues':
          return this.processIssueEvent(webhookData);

        case 'pull_request':
          return this.processPullRequestEvent(webhookData);

        case 'push':
          return this.processPushEvent(webhookData);

        case 'issue_comment':
          return this.processIssueCommentEvent(webhookData);

        case 'check_run':
          return this.processCheckRunEvent(webhookData);

        case 'installation':
          return this.processInstallationEvent(webhookData);

        default:
          this.logger.debug(`Unhandled event type: ${event}`);
          return { handled: false, event };
      }
    } catch (error) {
      this.logger.error(`Error processing ${event} event:`, error);
      throw error; // Will trigger retry
    }
  }

  private async processIssueEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, issue, repository } = payload;

    // Additional async processing for issue events
    // This runs in the background after the immediate sync

    // Log for analytics
    this.logger.log(`Processed issue ${action}: ${repository.full_name}#${issue.number}`);

    return {
      handled: true,
      action,
      issueNumber: issue.number,
      repository: repository.full_name,
    };
  }

  private async processPullRequestEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, pull_request, repository } = payload;

    this.logger.log(`Processed PR ${action}: ${repository.full_name}#${pull_request.number}`);

    // Handle PR merged externally
    if (action === 'closed' && pull_request.merged === true) {
      const [owner, repo] = (repository.full_name as string).split('/');
      if (owner && repo) {
        try {
          await this.autoMergeService.handlePRMerged(
            owner,
            repo,
            pull_request.number,
            pull_request.merged_by?.login,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to handle PR merged for ${repository.full_name}#${pull_request.number}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    return {
      handled: true,
      action,
      prNumber: pull_request.number,
      repository: repository.full_name,
      merged: action === 'closed' && pull_request.merged === true,
    };
  }

  private async processPullRequestReviewEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, review, pull_request, repository } = payload;

    this.logger.log(
      `Processed PR review ${action}: ${repository.full_name}#${pull_request.number} — ${review.state}`,
    );

    // When a review is submitted and approved, try auto-merge
    if (action === 'submitted' && review.state === 'approved') {
      const [owner, repo] = (repository.full_name as string).split('/');
      if (owner && repo) {
        try {
          const result = await this.autoMergeService.checkAndMerge(
            owner,
            repo,
            pull_request.number,
          );
          this.logger.log(
            `Auto-merge check for ${repository.full_name}#${pull_request.number}: merged=${result.merged}${result.reason ? `, reason=${result.reason}` : ''}`,
          );
        } catch (error) {
          this.logger.warn(
            `Auto-merge check failed for ${repository.full_name}#${pull_request.number}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    }

    return {
      handled: true,
      action,
      reviewState: review.state,
      prNumber: pull_request.number,
      repository: repository.full_name,
    };
  }

  private async processPushEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { repository, commits, ref, before } = payload;
    const repoFullName: string = repository.full_name;
    const defaultBranch: string = repository.default_branch;

    this.logger.log(
      `Processed push to ${repository.full_name} (${ref}): ${commits?.length || 0} commits`,
    );

    // Only trigger codebase indexing for pushes to the default branch
    const pushedBranch = (ref as string)?.replace('refs/heads/', '');
    if (pushedBranch === defaultBranch && before) {
      await this.triggerCodebaseIndexing(repoFullName, before);
    }

    return {
      handled: true,
      repository: repoFullName,
      ref,
      commitCount: commits?.length || 0,
    };
  }

  /**
   * Trigger incremental codebase indexing when code is pushed to the default branch.
   * Looks up ProjectGithubConfig to find the linked application and tenant.
   */
  private async triggerCodebaseIndexing(
    repoFullName: string,
    beforeSha: string,
  ): Promise<void> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) return;

    try {
      // Find the ProjectGithubConfig that links this repo to an application
      const config = await this.prisma.projectGithubConfig.findFirst({
        where: { owner, repo },
        include: { application: true, installation: true },
      });

      if (!config) {
        this.logger.debug(
          `No ProjectGithubConfig found for ${repoFullName}, skipping codebase indexing`,
        );
        return;
      }

      // Check if codebase is already indexed (skip if never indexed — needs manual trigger)
      const status = await this.prisma.codebaseIndexStatus.findUnique({
        where: { applicationId: config.applicationId },
      });

      if (!status || status.status === 'idle') {
        this.logger.debug(
          `Codebase not yet indexed for app ${config.applicationId}, skipping incremental index`,
        );
        return;
      }

      if (status.status === 'indexing') {
        this.logger.debug(
          `Codebase already indexing for app ${config.applicationId}, skipping`,
        );
        return;
      }

      // Queue incremental index
      const tenantId = config.installation.tenantId;
      const sinceCommitSha = status.lastCommitSha || beforeSha;

      const jobId = await this.codebaseIndexer.queueIncrementalIndex(
        config.applicationId,
        tenantId,
        sinceCommitSha,
        'webhook',
      );

      this.logger.log(
        `Queued incremental codebase index for ${repoFullName} (app: ${config.applicationId}), job: ${jobId}`,
      );
    } catch (error) {
      // Don't let indexing failures break webhook processing
      this.logger.warn(
        `Failed to trigger codebase indexing for ${repoFullName}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async processIssueCommentEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, issue, repository } = payload;

    this.logger.log(`Processed comment on ${repository.full_name}#${issue.number}`);

    return {
      handled: true,
      action,
      issueNumber: issue.number,
      repository: repository.full_name,
    };
  }

  /**
   * Process check_run events (CI status feedback)
   */
  private async processCheckRunEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, check_run, repository } = payload;

    this.logger.log(
      `Processed check_run ${action}: ${check_run.name} on ${repository.full_name} - ${check_run.conclusion || 'pending'}`,
    );

    // On completed check runs with failure, find linked tickets
    if (action === 'completed' && check_run.conclusion === 'failure') {
      const linkedTickets: string[] = [];

      for (const pr of check_run.pull_requests || []) {
        const githubIssue = await this.prisma.githubIssue.findFirst({
          where: {
            githubRepo: repository.full_name,
            githubIssueNumber: pr.number,
          },
        });

        if (githubIssue?.ticketId) {
          linkedTickets.push(githubIssue.ticketId);
        }
      }

      if (linkedTickets.length > 0) {
        this.logger.log(
          `CI failure for "${check_run.name}" linked to tickets: ${linkedTickets.join(', ')}`,
        );
      }

      return {
        handled: true,
        action,
        checkName: check_run.name,
        conclusion: check_run.conclusion,
        repository: repository.full_name,
        linkedTickets,
      };
    }

    return {
      handled: true,
      action,
      checkName: check_run.name,
      conclusion: check_run.conclusion,
      repository: repository.full_name,
    };
  }

  /**
   * Process installation lifecycle events
   */
  private async processInstallationEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, installation, sender } = payload;

    this.logger.log(
      `Processed installation ${action}: ${installation.account.login} (ID: ${installation.id})`,
    );

    switch (action) {
      case 'created': {
        // The synchronous handler logs the event. The actual GithubInstallation
        // record is created during the installation callback flow (US-1.2)
        // when the tenant mapping is known.
        return {
          handled: true,
          action,
          installationId: installation.id,
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          senderLogin: sender.login,
        };
      }

      case 'deleted': {
        // Synchronous handler already removes the record.
        // Async processor handles any additional cleanup.
        // Remove related project configs that reference this installation.
        const installationIdBigInt = BigInt(installation.id);
        try {
          const deleted = await this.prisma.projectGithubConfig.deleteMany({
            where: { installationId: installationIdBigInt },
          });
          if (deleted.count > 0) {
            this.logger.log(
              `Cleaned up ${deleted.count} project configs for deleted installation ${installation.id}`,
            );
          }
        } catch {
          this.logger.debug(
            `No project configs to clean up for installation ${installation.id}`,
          );
        }

        return {
          handled: true,
          action,
          installationId: installation.id,
        };
      }

      case 'suspend':
      case 'unsuspend': {
        // Synchronous handler already updates suspendedAt.
        return {
          handled: true,
          action,
          installationId: installation.id,
        };
      }

      default:
        this.logger.debug(`Unhandled installation action: ${action}`);
        return { handled: false, action, installationId: installation.id };
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GithubWebhookJobData>) {
    this.logger.debug(`Job ${job.id} completed for event: ${job.data.event}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GithubWebhookJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed for event: ${job.data.event}`, error.stack);
  }
}
