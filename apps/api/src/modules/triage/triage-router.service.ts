import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TriageClassification, TriageRoute } from './interfaces/triage.interfaces';

const CONFIDENCE_THRESHOLDS = {
  AUTO_ROUTE: 0.7,
  MANUAL_TRIAGE: 0.5,
};

/** Maps ticket severity to BullMQ priority (lower = higher priority). */
function severityToBullMQPriority(severity: string | null | undefined): number {
  switch (severity) {
    case 'critical': return 1;
    case 'high':     return 2;
    case 'medium':   return 5;
    case 'low':      return 10;
    default:         return 5;
  }
}

@Injectable()
export class TriageRouterService {
  private readonly logger = new Logger(TriageRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('n1-triage') private readonly n1TriageQueue: Queue,
    @InjectQueue('agent-orchestration')
    private readonly agentQueue: Queue,
  ) {}

  /**
   * Route a ticket to the appropriate handler based on classification results.
   */
  async route(
    ticketId: string,
    tenantId: string,
    applicationId: string,
    classification: TriageClassification,
  ): Promise<TriageRoute> {
    const { type, typeConfidence } = classification;

    // Below manual threshold — require human triage
    if (typeConfidence < CONFIDENCE_THRESHOLDS.MANUAL_TRIAGE) {
      this.logger.log(
        `Ticket ${ticketId}: low confidence (${typeConfidence}), requires manual triage`,
      );
      return { action: 'manual_triage', reason: 'Low confidence classification' };
    }

    const needsReview = typeConfidence < CONFIDENCE_THRESHOLDS.AUTO_ROUTE;

    switch (type) {
      case 'bug':
        return this.routeBug(ticketId, tenantId, applicationId, needsReview);

      case 'feature_request':
        return this.routeFeatureRequest(
          ticketId,
          tenantId,
          applicationId,
          needsReview,
        );

      case 'question':
        return this.routeQuestion(ticketId, tenantId, applicationId, needsReview);

      default:
        this.logger.warn(`Ticket ${ticketId}: unknown type "${type}", manual triage`);
        return { action: 'manual_triage', reason: `Unknown type: ${type}` };
    }
  }

  private async routeBug(
    ticketId: string,
    tenantId: string,
    applicationId: string,
    needsReview: boolean,
  ): Promise<TriageRoute> {
    // Check if app has a GitHub config (deep analysis requires it)
    const githubConfig = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
      select: { id: true },
    });

    if (!githubConfig) {
      this.logger.log(
        `Ticket ${ticketId}: classified as bug but no GitHub config, setting status to open`,
      );
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: 'open' },
      });
      return {
        action: 'manual_triage',
        needsReview,
        reason: 'Bug classified but no GitHub repository configured for deep analysis',
      };
    }

    // Enqueue N1 triage (Level 1 assessment before deep analysis)
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { severity: true },
    });
    const priority = severityToBullMQPriority(ticket?.severity);

    await this.n1TriageQueue.add(
      'assess',
      { ticketId, tenantId, applicationId },
      {
        priority,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    this.logger.log(`Ticket ${ticketId}: deep analysis enqueued with priority ${priority} (severity: ${ticket?.severity ?? 'unknown'})`);

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'analyzing' },
    });

    this.logger.log(`Ticket ${ticketId}: routed to n1_triage`);
    return { action: 'deep_analysis', needsReview };
  }

  private async routeFeatureRequest(
    ticketId: string,
    tenantId: string,
    applicationId: string,
    needsReview: boolean,
  ): Promise<TriageRoute> {
    await this.agentQueue.add(
      'generate-proposal',
      {
        type: 'generate-proposal',
        ticketId,
        tenantId,
        applicationId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'open' },
    });

    this.logger.log(`Ticket ${ticketId}: routed to proposal_generation`);
    return { action: 'proposal_generation', needsReview };
  }

  private async routeQuestion(
    ticketId: string,
    tenantId: string,
    applicationId: string,
    needsReview: boolean,
  ): Promise<TriageRoute> {
    await this.agentQueue.add(
      'auto-answer',
      {
        type: 'auto-answer',
        ticketId,
        tenantId,
        applicationId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'open' },
    });

    this.logger.log(`Ticket ${ticketId}: routed to auto_answer`);
    return { action: 'auto_answer', needsReview };
  }
}
