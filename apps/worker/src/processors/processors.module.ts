import { Module } from '@nestjs/common';
import { VideoAnalysisWorker } from '../workers/video-analysis.worker';
import { GithubSyncWorker } from '../workers/github-sync.worker';
import { AgentWorker } from '../workers/agent.worker';
import { IntegrationSyncWorker } from '../workers/integration-sync.worker';

/**
 * Processors Module
 *
 * Registers all BullMQ worker processors
 */
@Module({
  providers: [VideoAnalysisWorker, GithubSyncWorker, AgentWorker, IntegrationSyncWorker],
  exports: [VideoAnalysisWorker, GithubSyncWorker, AgentWorker, IntegrationSyncWorker],
})
export class ProcessorsModule {}
