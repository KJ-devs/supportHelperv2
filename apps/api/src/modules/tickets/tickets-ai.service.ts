import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Queue } from 'bullmq';

@Injectable()
export class TicketsAIService {
  private readonly logger = new Logger(TicketsAIService.name);

  constructor(
    private prisma: PrismaService,
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
   * Find similar tickets using vector search (pgvector)
   * Requires ticket to have embedding vector already generated
   */
  async findSimilar(ticketId: string, tenantId: string, limit: number = 5) {
    // Get the ticket with its embedding
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId,
      },
      select: {
        id: true,
        title: true,
        description: true,
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Note: pgvector extension needs to be enabled and embedding column indexed
    // This is a simplified query - actual implementation would use the vector similarity operator
    // Example: SELECT * FROM tickets ORDER BY embedding <-> $1 LIMIT $2

    try {
      // Using raw SQL for vector similarity
      // In production, you'd want to use Prisma's raw query with proper typing
      const similar = await this.prisma.$queryRaw`
        SELECT
          id,
          title,
          description,
          status,
          severity,
          type,
          "createdAt",
          1 - (embedding <-> (SELECT embedding FROM tickets WHERE id = ${ticketId})) as similarity
        FROM tickets
        WHERE
          "tenantId" = ${tenantId}
          AND id != ${ticketId}
          AND embedding IS NOT NULL
        ORDER BY embedding <-> (SELECT embedding FROM tickets WHERE id = ${ticketId})
        LIMIT ${limit}
      `;

      return similar;
    } catch (error) {
      this.logger.error('Vector search failed', error);

      // Fallback to keyword-based similarity
      return this.findSimilarByKeywords(ticket, tenantId, limit);
    }
  }

  /**
   * Fallback: Find similar tickets by keywords and title similarity
   */
  private async findSimilarByKeywords(
    ticket: any,
    tenantId: string,
    limit: number,
  ) {
    // Simple keyword-based similarity as fallback
    const keywords = this.extractKeywords(ticket.title, ticket.description);

    if (keywords.length === 0) {
      return [];
    }

    const similar = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        id: { not: ticket.id },
        OR: [
          {
            title: {
              contains: keywords[0],
              mode: 'insensitive',
            },
          },
          {
            keywords: {
              hasSome: keywords,
            },
          },
        ],
      },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        severity: true,
        type: true,
        createdAt: true,
      },
    });

    return similar.map((t) => ({
      ...t,
      similarity: 0.5, // Approximation
    }));
  }

  /**
   * Extract keywords from text (simple implementation)
   */
  private extractKeywords(title: string, description?: string): string[] {
    const text = `${title} ${description || ''}`.toLowerCase();

    // Remove common words and split
    const stopWords = new Set([
      'the',
      'is',
      'at',
      'which',
      'on',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'with',
      'to',
      'for',
      'of',
      'as',
      'by',
    ]);

    const words = text
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));

    // Return unique keywords
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
    // Note: This requires pgvector extension
    // The embedding column should be defined as: embedding vector(1536)
    // For OpenAI ada-002 embeddings

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
