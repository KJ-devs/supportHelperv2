import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { TriageClassificationService } from './triage-classification.service';
import { TriageRouterService } from './triage-router.service';
import {
  TriageContext,
  TriageResult,
} from './interfaces/triage.interfaces';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly classificationService: TriageClassificationService,
    private readonly routerService: TriageRouterService,
  ) {}

  /**
   * Run the triage process for a ticket.
   * Called by the worker via the internal API endpoint.
   */
  async runTriage(
    ticketId: string,
    tenantId: string,
    applicationId: string,
    options?: { skipClassification?: boolean; source?: string },
  ): Promise<TriageResult> {
    const startTime = Date.now();

    this.logger.log(`Starting triage for ticket ${ticketId} (source: ${options?.source || 'unknown'})`);

    // Record timeline event
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'triage_started',
        data: { source: options?.source || 'unknown' },
      },
    });

    try {
      // Load ticket with full context
      const context = await this.buildTriageContext(ticketId, tenantId);

      if (!context) {
        throw new NotFoundException(`Ticket ${ticketId} not found`);
      }

      // Check if ticket is already triaged with high confidence
      if (this.isAlreadyTriaged(context)) {
        this.logger.log(`Ticket ${ticketId}: already triaged with high confidence, skipping`);

        // Still route even if classification is skipped
        const route = await this.routerService.route(
          ticketId,
          tenantId,
          applicationId,
          {
            type: context.ticket.existingType as 'bug' | 'feature_request' | 'question',
            typeConfidence: context.ticket.existingTypeConfidence!,
            severity: 'medium',
            severityConfidence: 0.5,
            summary: context.ticket.aiSummary || context.ticket.title || '',
            keywords: context.ticket.keywords,
            reasoning: 'Pre-existing high-confidence classification',
          },
        );

        await this.recordTriageCompleted(ticketId, tenantId, {
          type: context.ticket.existingType!,
          typeConfidence: context.ticket.existingTypeConfidence!,
          severity: 'medium',
          severityConfidence: 0.5,
          routedTo: route.action,
          reasoning: 'Pre-existing classification used',
        });

        return {
          success: true,
          ticketId,
          classification: null,
          route,
          duration: Date.now() - startTime,
        };
      }

      // Run AI classification (unless explicitly skipped)
      const classification = await this.classificationService.classify(context, tenantId);

      // Update ticket with classification results
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          type: classification.type,
          typeConfidence: classification.typeConfidence,
          severity: classification.severity,
          severityConfidence: classification.severityConfidence,
          aiSummary: classification.summary || undefined,
          keywords: classification.keywords,
        },
      });

      // Route based on classification
      const route = await this.routerService.route(
        ticketId,
        tenantId,
        applicationId,
        classification,
      );

      // Record timeline event
      await this.recordTriageCompleted(ticketId, tenantId, {
        type: classification.type,
        typeConfidence: classification.typeConfidence,
        severity: classification.severity,
        severityConfidence: classification.severityConfidence,
        routedTo: route.action,
        reasoning: classification.reasoning,
        needsReview: route.needsReview,
      });

      this.logger.log(
        `Triage complete for ticket ${ticketId}: ` +
          `type=${classification.type} (${classification.typeConfidence}), ` +
          `routed to ${route.action}`,
      );

      return {
        success: true,
        ticketId,
        classification,
        route,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Triage failed for ticket ${ticketId}: ${message}`);

      await this.prisma.ticketEvent.create({
        data: {
          ticketId,
          tenantId,
          eventType: 'triage_failed',
          data: { error: message },
        },
      });

      return {
        success: false,
        ticketId,
        classification: null,
        route: { action: 'manual_triage', reason: message },
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  /**
   * Build the full triage context from ticket data.
   */
  private async buildTriageContext(
    ticketId: string,
    tenantId: string,
  ): Promise<TriageContext | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        media: {
          include: {
            videoEvents: {
              select: {
                timestampMs: true,
                ocrText: true,
                eventType: true,
                eventData: true,
              },
              orderBy: { timestampMs: 'asc' },
              take: 20,
            },
          },
        },
        application: {
          select: {
            id: true,
            githubConfigs: {
              select: { id: true, owner: true, repo: true, isPrimary: true },
            },
          },
        },
      },
    });

    if (!ticket) return null;

    // Parse user context
    const userCtx = ticket.userContext as Record<string, string> | null;
    const userContext = userCtx
      ? {
          os: userCtx.os || null,
          browser: userCtx.browser || null,
          url: userCtx.url || null,
          viewport: userCtx.screenResolution || null,
        }
      : null;

    // Extract video analysis data
    let videoAnalysis: TriageContext['videoAnalysis'] = null;
    if (ticket.media.length > 0) {
      const ocrTexts: string[] = [];
      const errors: string[] = [];
      const urls: string[] = [];
      const components: string[] = [];

      for (const media of ticket.media) {
        for (const event of media.videoEvents) {
          if (event.ocrText) {
            ocrTexts.push(event.ocrText);
          }
        }

        // Extract visual cues from media metadata
        const metadata = media.metadata as Record<string, unknown> | null;
        if (metadata?.visualCues) {
          const cues = metadata.visualCues as Record<string, string[]>;
          if (cues.errors) errors.push(...cues.errors);
          if (cues.urls) urls.push(...cues.urls);
          if (cues.components) components.push(...cues.components);
        }
      }

      if (ocrTexts.length > 0 || errors.length > 0) {
        videoAnalysis = {
          ocrTexts,
          visualCues: { errors, urls, components },
        };
      }
    }

    // Codebase metadata
    const githubConfig = ticket.application?.githubConfigs?.find((c: { isPrimary: boolean }) => c.isPrimary) ?? ticket.application?.githubConfigs?.[0];
    let hasIndexedCodebase = false;

    if (githubConfig) {
      const indexStatus = await this.prisma.codebaseIndexStatus.findFirst({
        where: { applicationId: ticket.application!.id },
        select: { status: true },
      });
      hasIndexedCodebase = indexStatus?.status === 'completed';
    }

    // Find similar tickets via embedding (if available)
    const similarTickets = await this.findSimilarTickets(ticket, tenantId);

    return {
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        aiSummary: ticket.aiSummary,
        existingType: ticket.type,
        existingTypeConfidence: ticket.typeConfidence
          ? Number(ticket.typeConfidence)
          : null,
        keywords: ticket.keywords,
      },
      userContext,
      videoAnalysis,
      codebaseMetadata: {
        hasIndexedCodebase,
        hasGithubConfig: !!githubConfig,
        repoName: githubConfig
          ? `${githubConfig.owner}/${githubConfig.repo}`
          : null,
      },
      similarTickets,
    };
  }

  /**
   * Find similar tickets using text search (pgvector embedding search
   * would be ideal but requires the ticket to have an embedding first).
   */
  private async findSimilarTickets(
    ticket: { id: string; title: string | null; description: string | null; tenantId: string },
    tenantId: string,
  ): Promise<TriageContext['similarTickets']> {
    const searchText = ticket.title || ticket.description;
    if (!searchText) return [];

    try {
      // Simple text-based search for now; pgvector can be added later
      const similar = await this.prisma.ticket.findMany({
        where: {
          tenantId,
          id: { not: ticket.id },
          status: { in: ['resolved', 'closed'] },
          OR: [
            { title: { contains: searchText.slice(0, 50), mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
        take: 3,
        orderBy: { createdAt: 'desc' },
      });

      return similar.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        resolution: t.status === 'resolved' ? 'resolved' : null,
        similarity: 0.5, // approximate
      }));
    } catch {
      return [];
    }
  }

  /**
   * Check if the ticket already has a high-confidence classification.
   */
  private isAlreadyTriaged(context: TriageContext): boolean {
    return (
      !!context.ticket.existingType &&
      !!context.ticket.existingTypeConfidence &&
      context.ticket.existingTypeConfidence >= 0.8
    );
  }

  private async recordTriageCompleted(
    ticketId: string,
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType: 'triage_completed',
        data: data as Prisma.InputJsonValue,
      },
    });
  }
}
