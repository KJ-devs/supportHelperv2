import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';

export interface GithubWebhookJobData {
  event: string;
  eventData: any;
  payload: any;
  deliveryId: string;
  receivedAt: string;
}

@Processor('github')
export class GithubWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(GithubWebhookProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<GithubWebhookJobData>): Promise<any> {
    const { event, eventData, deliveryId } = job.data;

    this.logger.log(`Processing GitHub webhook job: ${event} (${deliveryId})`);

    try {
      switch (event) {
        case 'issues':
          return this.processIssueEvent(job.data);

        case 'pull_request':
          return this.processPullRequestEvent(job.data);

        case 'push':
          return this.processPushEvent(job.data);

        case 'issue_comment':
          return this.processIssueCommentEvent(job.data);

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
    const { payload, eventData } = data;
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

    return {
      handled: true,
      action,
      prNumber: pull_request.number,
      repository: repository.full_name,
    };
  }

  private async processPushEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { repository, commits, ref } = payload;

    this.logger.log(
      `Processed push to ${repository.full_name} (${ref}): ${commits?.length || 0} commits`
    );

    return {
      handled: true,
      repository: repository.full_name,
      ref,
      commitCount: commits?.length || 0,
    };
  }

  private async processIssueCommentEvent(data: GithubWebhookJobData) {
    const { payload } = data;
    const { action, issue, comment, repository } = payload;

    this.logger.log(`Processed comment on ${repository.full_name}#${issue.number}`);

    return {
      handled: true,
      action,
      issueNumber: issue.number,
      repository: repository.full_name,
    };
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
