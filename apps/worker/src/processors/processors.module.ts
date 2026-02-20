import { Module } from '@nestjs/common';
import { VideoAnalysisWorker } from '../workers/video-analysis.worker';
import { GithubSyncWorker } from '../workers/github-sync.worker';
import { AgentWorker } from '../workers/agent.worker';
import { IntegrationSyncWorker } from '../workers/integration-sync.worker';
import { CodebaseIndexingWorker } from '../workers/codebase-indexing.worker';
import { DeepAnalysisWorker } from '../workers/deep-analysis.worker';
import { BackupWorker } from '../workers/backup.worker';
import { DeadLetterWorker } from '../workers/dead-letter.worker';
import { UsageSnapshotProcessor } from './usage-snapshot.processor';

/**
 * Processors Module
 *
 * Registers all BullMQ worker processors including dead letter queue
 */
@Module({
  providers: [
    VideoAnalysisWorker,
    GithubSyncWorker,
    AgentWorker,
    IntegrationSyncWorker,
    CodebaseIndexingWorker,
    DeepAnalysisWorker,
    BackupWorker,
    DeadLetterWorker,
    UsageSnapshotProcessor,
  ],
  exports: [
    VideoAnalysisWorker,
    GithubSyncWorker,
    AgentWorker,
    IntegrationSyncWorker,
    CodebaseIndexingWorker,
    DeepAnalysisWorker,
    BackupWorker,
    DeadLetterWorker,
    UsageSnapshotProcessor,
  ],
})
export class ProcessorsModule {}
