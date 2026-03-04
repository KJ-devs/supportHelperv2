import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { Queue } from 'bullmq';
import { SimilarTicketContext, SimilarTicketFix } from '@support-helper/shared';

@Injectable()
export class TicketsAIService {
  private readonly logger = new Logger(TicketsAIService.name);

  constructor(
    private prisma: PrismaService,
    private readonly aiService: AIService,
    @InjectQueue('ticket-analysis') private analysisQueue: Queue,
  ) {
    this.logger.log('TicketsAIService initialized');
  }

  /**
   * Enqueue ticket for AI analysis
   */
  async enqueueAnalysis(ticketId: string, priority: number = 5): Promise<void> {
    try {
      await this.analysisQueue.add(
        'analyze-ticket',
        {
          ticketId,
          timestamp: new Date().toISOString(),
        },
        {
          priority,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(`Enqueued ticket ${ticketId} for AI analysis`);
    } catch (error) {
      this.logger.error(
        `Failed to enqueue ticket ${ticketId} for analysis`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate and store embedding for a ticket using its enriched text context.
   * Called after triage or video analysis to persist a rich embedding.
   * Silent on error to avoid blocking the pipeline.
   */
  async generateAndStoreEmbedding(ticketId: string, tenantId: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId, tenantId },
        select: { title: true, description: true, aiSummary: true, keywords: true },
      });

      if (!ticket) {
        this.logger.warn(`generateAndStoreEmbedding: ticket ${ticketId} not found`);
        return;
      }

      const textParts = [
        ticket.title,
        ticket.description,
        ticket.aiSummary,
        ticket.keywords?.join(' '),
      ].filter(Boolean);

      if (textParts.length === 0) return;

      const text = textParts.join('\n');
      const embedding = await this.aiService.generateEmbedding(text, tenantId);

      if (embedding.length === 0) return;

      await this.storeEmbedding(ticketId, embedding);
      this.logger.log(`Generated and stored embedding for ticket ${ticketId} (${embedding.length}d)`);
    } catch (error) {
      this.logger.warn(`generateAndStoreEmbedding failed for ${ticketId}: ${(error as Error).message}`);
    }
  }

  /**
   * Find similar tickets using vector search (pgvector).
   * Falls back to keyword search if the ticket has no embedding yet.
   * Only returns resolved/closed tickets to provide actionable context.
   */
  async findSimilar(ticketId: string, tenantId: string, limit: number = 5): Promise<SimilarTicketContext[]> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, title: true, description: true, aiSummary: true, keywords: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    try {
      // Check if source ticket has an embedding
      const hasEmbedding = await this.prisma.$queryRaw<[{ has_emb: boolean }]>`
        SELECT embedding IS NOT NULL AS has_emb FROM tickets WHERE id = ${ticketId}
      `;

      if (!hasEmbedding[0]?.has_emb) {
        // No embedding on source — try inline generation for search
        const textParts = [ticket.title, ticket.description, ticket.aiSummary, ticket.keywords?.join(' ')].filter(Boolean);
        if (textParts.length > 0) {
          const tmpEmbedding = await this.aiService.generateEmbedding(textParts.join('\n'), tenantId);
          if (tmpEmbedding.length > 0) {
            return this.findSimilarByVector(ticketId, tenantId, tmpEmbedding, limit);
          }
        }
        // Complete fallback
        return this.findSimilarByKeywords(ticket, tenantId, limit);
      }

      return this.findSimilarByVectorFromDb(ticketId, tenantId, limit);
    } catch (error) {
      this.logger.error('Vector search failed', error);
      return this.findSimilarByKeywords(ticket, tenantId, limit);
    }
  }

  /**
   * Vector search using existing embedding in DB for the source ticket.
   */
  private async findSimilarByVectorFromDb(
    ticketId: string,
    tenantId: string,
    limit: number,
  ): Promise<SimilarTicketContext[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      title: string | null;
      ai_summary: string | null;
      keywords: string[];
      type: string | null;
      severity: string | null;
      status: string;
      diagnosis: unknown;
      resolved_at: Date | null;
      similarity: number;
    }>>`
      SELECT
        id,
        title,
        "aiSummary" AS ai_summary,
        keywords,
        type,
        severity,
        status,
        diagnosis,
        "resolvedAt" AS resolved_at,
        1 - (embedding <=> (SELECT embedding FROM tickets WHERE id = ${ticketId})) AS similarity
      FROM tickets
      WHERE
        "tenantId" = ${tenantId}
        AND id != ${ticketId}
        AND status IN ('resolved', 'closed')
        AND embedding IS NOT NULL
      ORDER BY embedding <=> (SELECT embedding FROM tickets WHERE id = ${ticketId})
      LIMIT ${limit}
    `;

    return rows.map((r) => this.mapToSimilarTicketContext(r));
  }

  /**
   * Vector search using an inline embedding (for tickets without a stored embedding).
   */
  private async findSimilarByVector(
    ticketId: string,
    tenantId: string,
    embedding: number[],
    limit: number,
  ): Promise<SimilarTicketContext[]> {
    const vectorStr = `[${embedding.join(',')}]`;
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      title: string | null;
      ai_summary: string | null;
      keywords: string[];
      type: string | null;
      severity: string | null;
      status: string;
      diagnosis: unknown;
      resolved_at: Date | null;
      similarity: number;
    }>>`
      SELECT
        id,
        title,
        "aiSummary" AS ai_summary,
        keywords,
        type,
        severity,
        status,
        diagnosis,
        "resolvedAt" AS resolved_at,
        1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM tickets
      WHERE
        "tenantId" = ${tenantId}
        AND id != ${ticketId}
        AND status IN ('resolved', 'closed')
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;

    return rows.map((r) => this.mapToSimilarTicketContext(r));
  }

  private mapToSimilarTicketContext(r: {
    id: string;
    title: string | null;
    ai_summary: string | null;
    keywords: string[];
    type: string | null;
    severity: string | null;
    status: string;
    diagnosis: unknown;
    resolved_at: Date | null;
    similarity: number;
  }): SimilarTicketContext {
    const rawDiagnosis = r.diagnosis as Record<string, unknown> | null;
    let diagnosis: SimilarTicketFix | undefined;

    if (rawDiagnosis?.rootCause) {
      const affectedFiles = (rawDiagnosis.affectedFiles as Array<{ filePath?: string } | string> | null)
        ?.map((f) => (typeof f === 'string' ? f : f.filePath ?? ''))
        .filter(Boolean);

      diagnosis = {
        rootCause: rawDiagnosis.rootCause as string,
        proposedFix: rawDiagnosis.suggestedFix as string | undefined,
        affectedFiles,
        prUrl: rawDiagnosis.prUrl as string | null | undefined,
      };
    }

    return {
      id: r.id,
      title: r.title,
      aiSummary: r.ai_summary,
      keywords: r.keywords ?? [],
      type: r.type,
      severity: r.severity,
      status: r.status,
      similarity: Number(r.similarity),
      diagnosis,
      resolvedAt: r.resolved_at?.toISOString() ?? null,
    };
  }

  /**
   * Fallback: Find similar tickets by keywords and title similarity
   */
  private async findSimilarByKeywords(
    ticket: { id: string; title?: string | null; description?: string | null; keywords?: string[] },
    tenantId: string,
    limit: number,
  ): Promise<SimilarTicketContext[]> {
    const keywords = ticket.keywords?.length
      ? ticket.keywords
      : this.extractKeywords(ticket.title ?? '', ticket.description ?? undefined);

    if (keywords.length === 0) return [];

    const similar = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        id: { not: ticket.id },
        status: { in: ['resolved', 'closed'] },
        OR: [
          { title: { contains: keywords[0], mode: 'insensitive' } },
          { keywords: { hasSome: keywords } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        aiSummary: true,
        keywords: true,
        type: true,
        severity: true,
        status: true,
        diagnosis: true,
        resolvedAt: true,
      },
    });

    return similar.map((t) => {
      const rawDiagnosis = t.diagnosis as Record<string, unknown> | null;
      let diagnosis: SimilarTicketFix | undefined;
      if (rawDiagnosis?.rootCause) {
        diagnosis = {
          rootCause: rawDiagnosis.rootCause as string,
          proposedFix: rawDiagnosis.suggestedFix as string | undefined,
        };
      }
      return {
        id: t.id,
        title: t.title,
        aiSummary: t.aiSummary,
        keywords: t.keywords ?? [],
        type: t.type,
        severity: t.severity,
        status: t.status,
        similarity: 0.5,
        diagnosis,
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
      };
    });
  }

  /**
   * Extract keywords from text (simple implementation)
   */
  private extractKeywords(title: string, description?: string): string[] {
    const text = `${title} ${description || ''}`.toLowerCase();

    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'in', 'with', 'to', 'for', 'of', 'as', 'by',
    ]);

    const words = text
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));

    return [...new Set(words)].slice(0, 10);
  }

  /**
   * Update ticket keywords
   */
  async updateKeywords(ticketId: string, keywords: string[]): Promise<void> {
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { keywords },
    });

    this.logger.debug(`Updated keywords for ticket ${ticketId}`);
  }

  /**
   * Generate and store embedding for a ticket
   * This would be called by the AI worker after analysis
   */
  async storeEmbedding(
    ticketId: string,
    embedding: number[],
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE tickets
        SET embedding = ${JSON.stringify(embedding)}::vector
        WHERE id = ${ticketId}
      `;

      this.logger.debug(`Stored embedding for ticket ${ticketId}`);
    } catch (error) {
      this.logger.error(`Failed to store embedding for ${ticketId}`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.analysisQueue.getWaitingCount(),
      this.analysisQueue.getActiveCount(),
      this.analysisQueue.getCompletedCount(),
      this.analysisQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupQueue(olderThan: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.analysisQueue.clean(olderThan, 100, 'completed');
    await this.analysisQueue.clean(olderThan, 100, 'failed');

    this.logger.log('Cleaned up old queue jobs');
  }
}
