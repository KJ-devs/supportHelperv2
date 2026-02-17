import { Module, Global } from '@nestjs/common';
import {
  FFmpegService,
  OCRService,
  OpenAIService,
  YoloService,
  S3Service,
  GithubService,
  MeilisearchService,
  PrismaService,
  EmailService,
  AgentService,
  GitAutomationService,
  PullRequestService,
} from './index';
import { DlqAlertService } from './dlq-alert.service';
import { JobMonitoringService } from './job-monitoring.service';
import { UsageSnapshotSchedulerService } from './usage-snapshot-scheduler.service';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.module';

/**
 * Services Module
 *
 * Provides all shared services for workers
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.USAGE_SNAPSHOT })],
  providers: [
    PrismaService,
    FFmpegService,
    OCRService,
    OpenAIService,
    YoloService,
    S3Service,
    GithubService,
    MeilisearchService,
    EmailService,
    AgentService,
    JobMonitoringService,
    DlqAlertService,
    GitAutomationService,
    PullRequestService,
    UsageSnapshotSchedulerService,
  ],
  exports: [
    PrismaService,
    FFmpegService,
    OCRService,
    OpenAIService,
    YoloService,
    S3Service,
    GithubService,
    MeilisearchService,
    EmailService,
    AgentService,
    JobMonitoringService,
    DlqAlertService,
    GitAutomationService,
    PullRequestService,
    UsageSnapshotSchedulerService,
  ],
})
export class ServicesModule {}
