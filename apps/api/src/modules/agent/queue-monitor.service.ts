import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface QueueJobCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface QueueMetrics {
  name: string;
  counts: QueueJobCounts;
  /** Average processing time in milliseconds over last 100 completed jobs */
  avgProcessingTimeMs: number | null;
  /** Failure rate as a fraction 0–1 over last 100+failed jobs */
  failureRate: number | null;
}

export interface QueueMetricsReport {
  timestamp: string;
  queues: QueueMetrics[];
}

@Injectable()
export class QueueMonitorService {
  private readonly logger = new Logger(QueueMonitorService.name);

  constructor(
    @InjectQueue('agent-orchestration') private readonly agentOrchestrationQueue: Queue,
    @InjectQueue('triage') private readonly triageQueue: Queue,
    @InjectQueue('deep-analysis') private readonly deepAnalysisQueue: Queue,
    @InjectQueue('video-analysis') private readonly videoAnalysisQueue: Queue,
    @InjectQueue('github-sync') private readonly githubSyncQueue: Queue,
    @InjectQueue('integration-sync') private readonly integrationSyncQueue: Queue,
  ) {}

  async getMetrics(): Promise<QueueMetricsReport> {
    const queues: Array<{ name: string; queue: Queue }> = [
      { name: 'agent-orchestration', queue: this.agentOrchestrationQueue },
      { name: 'triage', queue: this.triageQueue },
      { name: 'deep-analysis', queue: this.deepAnalysisQueue },
      { name: 'video-analysis', queue: this.videoAnalysisQueue },
      { name: 'github-sync', queue: this.githubSyncQueue },
      { name: 'integration-sync', queue: this.integrationSyncQueue },
    ];

    const results = await Promise.all(
      queues.map(({ name, queue }) => this.collectQueueMetrics(name, queue)),
    );

    return {
      timestamp: new Date().toISOString(),
      queues: results,
    };
  }

  private async collectQueueMetrics(name: string, queue: Queue): Promise<QueueMetrics> {
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );

      const jobCounts: QueueJobCounts = {
        waiting: counts['waiting'] ?? 0,
        active: counts['active'] ?? 0,
        delayed: counts['delayed'] ?? 0,
        failed: counts['failed'] ?? 0,
        completed: counts['completed'] ?? 0,
      };

      const { avgProcessingTimeMs, failureRate } = await this.computeRateMetrics(queue, jobCounts);

      return { name, counts: jobCounts, avgProcessingTimeMs, failureRate };
    } catch (error) {
      this.logger.warn(`Failed to collect metrics for queue "${name}": ${(error as Error).message}`);
      return {
        name,
        counts: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
        avgProcessingTimeMs: null,
        failureRate: null,
      };
    }
  }

  private async computeRateMetrics(
    queue: Queue,
    counts: QueueJobCounts,
  ): Promise<{ avgProcessingTimeMs: number | null; failureRate: number | null }> {
    try {
      const completedJobs = await queue.getJobs(['completed'], 0, 99);

      let avgProcessingTimeMs: number | null = null;
      if (completedJobs.length > 0) {
        const durations = completedJobs
          .filter((j) => j.processedOn != null && j.finishedOn != null)
          .map((j) => (j.finishedOn as number) - (j.processedOn as number));

        if (durations.length > 0) {
          avgProcessingTimeMs =
            Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length);
        }
      }

      let failureRate: number | null = null;
      const total = completedJobs.length + counts.failed;
      if (total > 0) {
        failureRate = counts.failed / total;
      }

      return { avgProcessingTimeMs, failureRate };
    } catch {
      return { avgProcessingTimeMs: null, failureRate: null };
    }
  }
}
