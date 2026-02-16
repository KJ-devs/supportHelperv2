import { Module } from '@nestjs/common';
import { VideoAnalysisWorker } from '../workers/video-analysis.worker';
import { GithubSyncWorker } from '../workers/github-sync.worker';
import { AgentWorker } from '../workers/agent.worker';
import { IntegrationSyncWorker } from '../workers/integration-sync.worker';
import { CodebaseIndexingWorker } from '../workers/codebase-indexing.worker';
import { BackupWorker } from '../workers/backup.worker';
import { DeadLetterWorker } from '../workers/dead-letter.worker';

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
    BackupWorker,
    DeadLetterWorker,
  ],
  exports: [
    VideoAnalysisWorker,
    GithubSyncWorker,
    AgentWorker,
    IntegrationSyncWorker,
    CodebaseIndexingWorker,
    BackupWorker,
    DeadLetterWorker,
  ],
})
export class ProcessorsModule {}
