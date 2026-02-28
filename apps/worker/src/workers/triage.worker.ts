import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as crypto from 'crypto';
import { QUEUE_NAMES } from '../queues';
import { TriageJobData, TriageWorkerResult } from '../queues/queue.types';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

/**
 * TriageWorker
 *
 * BullMQ processor that delegates ticket triage to the API process
 * via an internal HTTP call to POST /api/triage/internal/run.
 * The API's TriageService owns the classification and routing logic.
 *
 * Concurrency: 10 (triage is fast, single AI call)
 * Retry: 3 attempts with exponential backoff (5s base)
 */
@Processor(QUEUE_NAMES.TRIAGE, { concurrency: 10 })
export class TriageWorker extends WorkerHost {
  private readonly logger = new Logger(TriageWorker.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  /**
   * Build a minimal HS256 JWT for worker→API internal calls.
   * Uses the JWT_SECRET so the API can verify it with JwtService.verify().
   * The token identifies this process as the "worker-service" system account.
   */
  private buildServiceJwt(jwtSecret: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'worker-service',
        role: 'system',
        tenantId: 'system',
        iat: now,
        exp: now + 300, // valid for 5 minutes
      }),
    ).toString('base64url');

    const data = `${header}.${payload}`;
    const signature = crypto
      .createHmac('sha256', jwtSecret)
      .update(data)
      .digest('base64url');

    return `${data}.${signature}`;
  }

  async process(job: Job<TriageJobData>): Promise<TriageWorkerResult> {
    const { ticketId, tenantId, applicationId, source } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting triage for ticket ${ticketId} (source: ${source || 'unknown'})`);
    await job.updateProgress(10);

    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3001';
    const internalSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!internalSecret) {
      this.logger.error('INTERNAL_API_SECRET is not configured — cannot call internal API');
      return {
        success: false,
        ticketId,
        routedTo: null,
        duration: Date.now() - startTime,
        error: 'INTERNAL_API_SECRET not configured',
      };
    }

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured — cannot sign service account token');
      return {
        success: false,
        ticketId,
        routedTo: null,
        duration: Date.now() - startTime,
        error: 'JWT_SECRET not configured',
      };
    }

    const serviceJwt = this.buildServiceJwt(jwtSecret);
    const endpoint = `${apiUrl}/api/triage/internal/run`;

    this.logger.log(`Delegating triage for ticket ${ticketId} to API: ${endpoint}`);
    await job.updateProgress(20);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
          Authorization: `Bearer ${serviceJwt}`,
        },
        body: JSON.stringify({
          ticketId,
          tenantId,
          applicationId,
          source: source || 'auto',
          skipClassification: job.data.skipClassification,
        }),
      });

      await job.updateProgress(90);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API responded with ${response.status}: ${body}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        ticketId: string;
        classification: unknown;
        route: { action: string };
        duration: number;
        error?: string;
      };

      await job.updateProgress(100);

      this.logger.log(
        `Triage complete for ticket ${ticketId}: routed to ${result.route?.action || 'unknown'}`,
      );

      return {
        success: result.success,
        ticketId,
        routedTo: result.route?.action || null,
        duration: Date.now() - startTime,
        error: result.error,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Triage failed for ticket ${ticketId}: ${message}`);
      return {
        success: false,
        ticketId,
        routedTo: null,
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<TriageJobData>) {
    this.logger.log(
      `Triage job ${job.id} started for ticket ${job.data.ticketId} (attempt ${job.attemptsMade + 1})`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<TriageJobData>, result: TriageWorkerResult) {
    this.logger.log(
      `Triage job ${job.id} completed for ticket ${job.data.ticketId}: routed to ${result.routedTo || 'none'} (${result.duration}ms)`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<TriageJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Triage job failed without context: ${error.message}`);
      return;
    }
    this.logger.error(
      `Triage job ${job.id} failed for ticket ${job.data.ticketId}: ${getErrorMessage(error)}`,
      getErrorStack(error),
    );
  }
}
