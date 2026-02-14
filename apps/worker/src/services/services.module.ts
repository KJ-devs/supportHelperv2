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
} from './index';
import { JobMonitoringService } from './job-monitoring.service';

/**
 * Services Module
 *
 * Provides all shared services for workers
 */
@Global()
@Module({
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
  ],
})
export class ServicesModule {}
