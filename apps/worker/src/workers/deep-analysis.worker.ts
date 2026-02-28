import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import * as crypto from 'crypto';
import { QUEUE_NAMES } from '../queues';
import { DeepAnalysisJobData, DeepAnalysisResult } from '../queues/queue.types';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

/**
 * DeepAnalysisWorker
 *
 * BullMQ processor that delegates deep ticket analysis to the API process
 * via an internal HTTP call to POST /api/agent/v2/internal/analyze.
 * The API's DeepAnalysisService owns the full agentic loop logic.
 *
 * Concurrency: 5
 * Retry: 3 attempts with exponential backoff (30s base)
 */
@Processor(QUEUE_NAMES.DEEP_ANALYSIS, { concurrency: 5 })
export class DeepAnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(DeepAnalysisWorker.name);

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

  async process(job: Job<DeepAnalysisJobData>): Promise<DeepAnalysisResult> {
    const { ticketId, tenantId } = job.data;
    const startTime = Date.now();

    this.logger.log(`Starting deep analysis for ticket ${ticketId}`);
    await job.updateProgress(10);

    const apiUrl = this.configService.get<string>('API_URL') ?? 'http://localhost:3001';
    const internalSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!internalSecret) {
      this.logger.error('INTERNAL_API_SECRET is not configured — cannot call internal API');
      return {
        success: false,
        ticketId,
        diagnosisFound: false,
        duration: Date.now() - startTime,
        error: 'INTERNAL_API_SECRET not configured',
      };
    }

    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured — cannot sign service account token');
      return {
        success: false,
        ticketId,
        diagnosisFound: false,
        duration: Date.now() - startTime,
        error: 'JWT_SECRET not configured',
      };
    }

    const serviceJwt = this.buildServiceJwt(jwtSecret);
    const endpoint = `${apiUrl}/api/agent/v2/internal/analyze`;

    this.logger.log(`Delegating deep analysis for ticket ${ticketId} to API: ${endpoint}`);
    await job.updateProgress(20);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
          Authorization: `Bearer ${serviceJwt}`,
        },
        body: JSON.stringify({ ticketId, tenantId }),
      });

      await job.updateProgress(90);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API responded with ${response.status}: ${body}`);
      }

      const result = (await response.json()) as {
        ticketId: string;
        diagnosisFound: boolean;
        diagnosis: unknown;
      };

      await job.updateProgress(100);

      this.logger.log(
        `Deep analysis complete for ticket ${ticketId}: diagnosisFound=${result.diagnosisFound}`,
      );

      return {
        success: true,
        ticketId,
        diagnosisFound: result.diagnosisFound,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.error(`Deep analysis failed for ticket ${ticketId}: ${message}`);
      return {
        success: false,
        ticketId,
        diagnosisFound: false,
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Worker Events
  // ═══════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('active')
  onActive(job: Job<DeepAnalysisJobData>) {
    this.logger.log(
      `Deep analysis job ${job.id} started for ticket ${job.data.ticketId} (attempt ${job.attemptsMade + 1})`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<DeepAnalysisJobData>, result: DeepAnalysisResult) {
    this.logger.log(
      `Deep analysis job ${job.id} completed for ticket ${job.data.ticketId}: diagnosisFound=${result.diagnosisFound} (${result.duration}ms)`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<DeepAnalysisJobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Deep analysis job failed without context: ${error.message}`);
      return;
    }
    this.logger.error(
      `Deep analysis job ${job.id} failed for ticket ${job.data.ticketId}: ${getErrorMessage(error)}`,
      getErrorStack(error),
    );
  }
}
