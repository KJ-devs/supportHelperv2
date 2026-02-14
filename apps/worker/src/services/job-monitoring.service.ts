import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues';

/**
 * Job counts structure returned by BullMQ
 */
export interface JobCounts {
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
  paused?: number;
  [key: string]: number | undefined;
}

/**
 * Job Statistics for a single queue
 */
export interface QueueStats {
  queueName: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  metrics: {
    avgProcessingTime?: number;
    oldestWaitingJob?: Date;
    failureRate?: number;
  };
}

/**
 * Overall system job statistics
 */
export interface SystemStats {
  queues: QueueStats[];
  deadLetterQueue: QueueStats;
  summary: {
    totalWaiting: number;
    totalActive: number;
    totalFailed: number;
    overallFailureRate: number;
  };
  timestamp: Date;
}

/**
 * Job Monitoring Service
 *
 * Provides real-time job queue statistics and metrics:
 * - Job counts per queue (waiting, active, completed, failed)
 * - Average processing times
 * - Failure rates
 * - Dead letter queue status
 */
@Injectable()
export class JobMonitoringService {
  private readonly logger = new Logger(JobMonitoringService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.VIDEO_ANALYSIS)
    private readonly videoQueue: Queue,

    @InjectQueue(QUEUE_NAMES.GITHUB_SYNC)
    private readonly githubQueue: Queue,

    @InjectQueue(QUEUE_NAMES.AGENT_ORCHESTRATION)
    private readonly agentQueue: Queue,

    @InjectQueue(QUEUE_NAMES.INTEGRATION_SYNC)
    private readonly integrationQueue: Queue,

    @InjectQueue('dead-letter')
    private readonly deadLetterQueue: Queue,
  ) {}

  /**
   * Get statistics for all queues
   */
  async getSystemStats(): Promise<SystemStats> {
    const [videoStats, githubStats, agentStats, integrationStats, dlqStats] = await Promise.all([
      this.getQueueStats(this.videoQueue),
      this.getQueueStats(this.githubQueue),
      this.getQueueStats(this.agentQueue),
      this.getQueueStats(this.integrationQueue),
      this.getQueueStats(this.deadLetterQueue),
    ]);

    const queues = [videoStats, githubStats, agentStats, integrationStats];

    const summary = {
      totalWaiting: queues.reduce((sum, q) => sum + q.counts.waiting, 0),
      totalActive: queues.reduce((sum, q) => sum + q.counts.active, 0),
      totalFailed: queues.reduce((sum, q) => sum + q.counts.failed, 0),
      overallFailureRate: this.calculateOverallFailureRate(queues),
    };

    return {
      queues,
      deadLetterQueue: dlqStats,
      summary,
      timestamp: new Date(),
    };
  }

  /**
   * Get statistics for a specific queue
   */
  async getQueueStats(queue: Queue): Promise<QueueStats> {
    const [counts, metrics] = await Promise.all([
      this.getJobCounts(queue),
      this.calculateMetrics(queue),
    ]);

    return {
      queueName: queue.name,
      counts,
      metrics,
    };
  }

  /**
   * Get job counts for a queue
   */
  private async getJobCounts(queue: Queue): Promise<QueueStats['counts']> {
    const counts = await queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
    };
  }

  /**
   * Calculate queue metrics
   */
  private async calculateMetrics(queue: Queue): Promise<QueueStats['metrics']> {
    try {
      // Get completed jobs for avg processing time
      const completedJobs = await queue.getCompleted(0, 100);
      const avgProcessingTime = this.calculateAvgProcessingTime(completedJobs);

      // Get oldest waiting job
      const waitingJobs = await queue.getWaiting(0, 1);
      const oldestWaitingJob = waitingJobs[0]?.timestamp ? new Date(waitingJobs[0].timestamp) : undefined;

      // Calculate failure rate
      const failureRate = await this.calculateFailureRate(queue);

      return {
        avgProcessingTime,
        oldestWaitingJob,
        failureRate,
      };
    } catch (error) {
      this.logger.warn(`Failed to calculate metrics for ${queue.name}: ${error}`);
      return {};
    }
  }

  /**
   * Calculate average processing time from recent jobs
   */
  private calculateAvgProcessingTime(jobs: any[]): number | undefined {
    if (!jobs.length) return undefined;

    const processingTimes = jobs
      .filter((job) => job.finishedOn && job.processedOn)
      .map((job) => job.finishedOn - job.processedOn);

    if (!processingTimes.length) return undefined;

    const sum = processingTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / processingTimes.length);
  }

  /**
   * Calculate failure rate for a queue
   */
  private async calculateFailureRate(queue: Queue): Promise<number> {
    try {
      const counts = await queue.getJobCounts();
      const completed = counts.completed || 0;
      const failed = counts.failed || 0;
      const total = completed + failed;

      if (total === 0) return 0;

      return Math.round((failed / total) * 10000) / 100; // 2 decimal places
    } catch (error) {
      this.logger.warn(`Failed to calculate failure rate: ${error}`);
      return 0;
    }
  }

  /**
   * Calculate overall failure rate across all queues
   */
  private calculateOverallFailureRate(queues: QueueStats[]): number {
    const totalCompleted = queues.reduce((sum, q) => sum + q.counts.completed, 0);
    const totalFailed = queues.reduce((sum, q) => sum + q.counts.failed, 0);
    const total = totalCompleted + totalFailed;

    if (total === 0) return 0;

    return Math.round((totalFailed / total) * 10000) / 100; // 2 decimal places
  }

  /**
   * Get queue by name
   */
  async getQueueStatsByName(queueName: string): Promise<QueueStats | null> {
    let queue: Queue;

    switch (queueName) {
      case QUEUE_NAMES.VIDEO_ANALYSIS:
        queue = this.videoQueue;
        break;
      case QUEUE_NAMES.GITHUB_SYNC:
        queue = this.githubQueue;
        break;
      case QUEUE_NAMES.AGENT_ORCHESTRATION:
        queue = this.agentQueue;
        break;
      case QUEUE_NAMES.INTEGRATION_SYNC:
        queue = this.integrationQueue;
        break;
      case 'dead-letter':
        queue = this.deadLetterQueue;
        break;
      default:
        return null;
    }

    return this.getQueueStats(queue);
  }

  /**
   * Clear failed jobs from a queue
   * Useful for cleaning up after investigating failures
   */
  async clearFailedJobs(queueName: string): Promise<number> {
    const queue = await this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failedJobs = await queue.getFailed(0, -1);
    await Promise.all(failedJobs.map((job) => job.remove()));

    this.logger.log(`Cleared ${failedJobs.length} failed jobs from ${queueName}`);
    return failedJobs.length;
  }

  /**
   * Retry all failed jobs in a queue
   */
  async retryFailedJobs(queueName: string): Promise<number> {
    const queue = await this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failedJobs = await queue.getFailed(0, -1);
    await Promise.all(failedJobs.map((job) => job.retry()));

    this.logger.log(`Retrying ${failedJobs.length} failed jobs in ${queueName}`);
    return failedJobs.length;
  }

  /**
   * Helper to get queue instance by name
   */
  private async getQueueByName(queueName: string): Promise<Queue | null> {
    switch (queueName) {
      case QUEUE_NAMES.VIDEO_ANALYSIS:
        return this.videoQueue;
      case QUEUE_NAMES.GITHUB_SYNC:
        return this.githubQueue;
      case QUEUE_NAMES.AGENT_ORCHESTRATION:
        return this.agentQueue;
      case QUEUE_NAMES.INTEGRATION_SYNC:
        return this.integrationQueue;
      case 'dead-letter':
        return this.deadLetterQueue;
      default:
        return null;
    }
  }
}
