import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

/**
 * GracefulShutdownService
 *
 * Implements graceful shutdown for BullMQ queues in the API service.
 * When SIGTERM/SIGINT is received:
 * 1. Pauses all queues (no new jobs processed)
 * 2. Waits for active jobs to complete (with 30s timeout)
 * 3. Closes all queue connections
 * 4. Logs shutdown progress
 *
 * Queue names tracked:
 * - ticket-analysis (TicketsModule)
 * - github (GithubModule)
 * - media (MediaModule)
 * - video-analysis (Worker queue, API only enqueues)
 * - github-sync (Worker queue)
 * - agent-orchestration (AgentTasksModule)
 * - integration-sync (IntegrationsModule)
 * - codebase-indexing (CodebaseIndexModule)
 * - backup (BackupModule)
 * - dead-letter (QueuesModule)
 * - usage-snapshot (Worker queue)
 * - notification (NotificationModule)
 */
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds
  private readonly queues: Map<string, Queue> = new Map();

  /**
   * Queue names registered in the application
   * These match the BullModule.registerQueue() names across modules
   */
  private readonly QUEUE_NAMES = [
    'ticket-analysis',
    'github',
    'media',
    'video-analysis',
    'github-sync',
    'agent-orchestration',
    'integration-sync',
    'codebase-indexing',
    'backup',
    'dead-letter',
    'usage-snapshot',
    'notification',
  ];

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Lifecycle hook called when application receives shutdown signal
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Initiating graceful shutdown for BullMQ queues (signal: ${signal || 'unknown'})`);

    const startTime = Date.now();

    try {
      // Step 1: Get all queue instances
      await this.collectQueues();

      if (this.queues.size === 0) {
        this.logger.log('No BullMQ queues found, skipping shutdown');
        return;
      }

      this.logger.log(`Found ${this.queues.size} queues to shutdown`);

      // Step 2: Pause all queues (prevents new jobs from being processed)
      await this.pauseAllQueues();

      // Step 3: Wait for active jobs to complete (with timeout)
      await this.waitForActiveJobs();

      // Step 4: Close all queue connections
      await this.closeAllQueues();

      const duration = Date.now() - startTime;
      this.logger.log(`BullMQ graceful shutdown completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `BullMQ shutdown failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Collect all queue instances from the module registry
   */
  private async collectQueues(): Promise<void> {
    for (const queueName of this.QUEUE_NAMES) {
      try {
        const token = getQueueToken(queueName);
        const queue = this.moduleRef.get<Queue>(token, { strict: false });

        if (queue) {
          this.queues.set(queueName, queue);
          this.logger.debug(`Registered queue for shutdown: ${queueName}`);
        }
      } catch (error) {
        // Queue not registered in this application instance (e.g., worker-only queues in API)
        this.logger.debug(`Queue ${queueName} not found in this instance`);
      }
    }
  }

  /**
   * Pause all queues to prevent new jobs from being processed
   */
  private async pauseAllQueues(): Promise<void> {
    this.logger.log('Pausing all queues...');

    const pausePromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        await queue.pause();
        this.logger.debug(`Paused queue: ${name}`);
      } catch (error) {
        this.logger.warn(
          `Failed to pause queue ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    await Promise.allSettled(pausePromises);
    this.logger.log('All queues paused');
  }

  /**
   * Wait for active jobs to complete (with timeout)
   */
  private async waitForActiveJobs(): Promise<void> {
    this.logger.log(`Waiting for active jobs to complete (timeout: ${this.SHUTDOWN_TIMEOUT_MS}ms)...`);

    const startTime = Date.now();
    const checkInterval = 1000; // Check every 1 second

    while (Date.now() - startTime < this.SHUTDOWN_TIMEOUT_MS) {
      const activeJobCounts = await this.getActiveJobCounts();
      const totalActiveJobs = Object.values(activeJobCounts).reduce((sum, count) => sum + count, 0);

      if (totalActiveJobs === 0) {
        this.logger.log('All active jobs completed');
        return;
      }

      // Log queues with active jobs
      const activeQueues = Object.entries(activeJobCounts)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => `${name}:${count}`)
        .join(', ');

      this.logger.log(`Waiting for ${totalActiveJobs} active jobs: ${activeQueues}`);

      // Wait before next check
      await this.sleep(checkInterval);
    }

    // Timeout reached
    const activeJobCounts = await this.getActiveJobCounts();
    const totalActiveJobs = Object.values(activeJobCounts).reduce((sum, count) => sum + count, 0);

    if (totalActiveJobs > 0) {
      this.logger.warn(
        `Shutdown timeout reached with ${totalActiveJobs} active jobs remaining - forcing shutdown`,
      );
    }
  }

  /**
   * Get active job counts for all queues
   */
  private async getActiveJobCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};

    const countPromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        const activeCount = await queue.getActiveCount();
        counts[name] = activeCount;
      } catch (error) {
        this.logger.warn(
          `Failed to get active count for queue ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
        counts[name] = 0;
      }
    });

    await Promise.allSettled(countPromises);
    return counts;
  }

  /**
   * Close all queue connections
   */
  private async closeAllQueues(): Promise<void> {
    this.logger.log('Closing all queue connections...');

    const closePromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        await queue.close();
        this.logger.debug(`Closed queue: ${name}`);
      } catch (error) {
        this.logger.warn(
          `Failed to close queue ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    await Promise.allSettled(closePromises);
    this.logger.log('All queues closed');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
