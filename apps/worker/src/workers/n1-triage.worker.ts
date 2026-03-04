import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues';
import { N1TriageJobData, N1TriageResult } from '../queues/queue.types';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';
import { buildServiceJwt } from '../utils/jwt.utils';

/**
 * N1TriageWorker
 *
 * BullMQ processor that delegates N1 (Level 1) ticket assessment to the API
 * via an internal HTTP call to POST /api/n1-triage/internal/assess.
 *
 * N1 assessment waits for video analysis (up to 90s), then runs a single AI call
 * to decide: no_fix_needed, duplicate, or escalate_n2.
 *
 * Concurrency: 10 (N1 is a single AI call after the video wait)
 * Retry: 3 attempts with exponential backoff (5s base)
 */
@Processor(QUEUE_NAMES.N1_TRIAGE, { concurrency: 10 })
export class N1TriageWorker extends WorkerHost {
  private readonly logger = new Logger(N1TriageWorker.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async process(job: Job<N1TriageJobData>): Promise<N1TriageResult> {
    const { ticketId, tenantId, applicationId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting N1 triage for ticket ${ticketId}`);
    await job.updateProgress(10);

    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3001';
    const internalSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    const jwtSecret =
      this.configService.get<string>('WORKER_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (!internalSecret) {
      this.logger.error('INTERNAL_API_SECRET is not configured');
      return {
        success: false,
        ticketId,
        decision: null,
        duration: Date.now() - startTime,
        error: 'INTERNAL_API_SECRET not configured',
      };
    }

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured');
      return {
        success: false,
        ticketId,
        decision: null,
        duration: Date.now() - startTime,
        error: 'JWT_SECRET not configured',
      };
    }

    const serviceJwt = buildServiceJwt(jwtSecret);
    const endpoint = `${apiUrl}/api/n1-triage/internal/assess`;

    this.logger.log(`Delegating N1 triage for ticket ${ticketId} to API: ${endpoint}`);
    await job.updateProgress(20);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
          Authorization: `Bearer ${serviceJwt}`,
        },
        body: JSON.stringify({ ticketId, tenantId, applicationId }),
      });

      await job.updateProgress(90);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API responded with ${response.status}: ${body}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        decision: string | null;
        error?: string;
      };

      await job.updateProgress(100);

      this.logger.log(
        `N1 triage complete for ticket ${ticketId}: decision=${result.decision || 'unknown'}`
      );

      return {
        success: result.success,
        ticketId,
        decision: result.decision,
        duration: Date.now() - startTime,
        error: result.error,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`N1 triage failed for ticket ${ticketId}: ${message}`);
      return {
        success: false,
        ticketId,
        decision: null,
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<N1TriageJobData>) {
    this.logger.log(
      `N1 triage job ${job.id} started for ticket ${job.data.ticketId} (attempt ${job.attemptsMade + 1})`
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<N1TriageJobData>, result: N1TriageResult) {
    this.logger.log(
      `N1 triage job ${job.id} completed for ticket ${job.data.ticketId}: decision=${result.decision || 'none'} (${result.duration}ms)`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<N1TriageJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`N1 triage job failed without context: ${error.message}`);
      return;
    }
    this.logger.error(
      `N1 triage job ${job.id} failed for ticket ${job.data.ticketId}: ${getErrorMessage(error)}`,
      getErrorStack(error)
    );
  }
}
