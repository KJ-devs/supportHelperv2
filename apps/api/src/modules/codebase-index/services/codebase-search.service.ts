import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AIService } from '../../../ai/ai.service';
import { CodeSearchResult } from '../types/codebase-index.types';

@Injectable()
export class CodebaseSearchService {
  private readonly logger = new Logger(CodebaseSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService
  ) {}

  /**
   * Find the most relevant code chunks for a search query using vector similarity.
   */
  async findRelevantFiles(
    applicationId: string,
    query: string,
    limit: number = 10
  ): Promise<CodeSearchResult[]> {
    const queryEmbedding = await this.aiService.generateEmbedding(query);
    if (queryEmbedding.length === 0) {
      this.logger.warn('Failed to generate query embedding, returning empty results');
      return [];
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results: Array<{
      file_path: string;
      chunk_index: number;
      content: string;
      language: string;
      metadata: unknown;
      distance: number;
    }> = await this.prisma.$queryRaw`
      SELECT file_path, chunk_index, content, language, metadata,
             embedding <=> ${embeddingStr}::vector AS distance
      FROM codebase_embeddings
      WHERE application_id = ${applicationId}::uuid
      ORDER BY distance
      LIMIT ${limit}
    `;

    return results.map(row => ({
      filePath: row.file_path,
      chunkIndex: row.chunk_index,
      content: row.content,
      language: row.language,
      distance: Number(row.distance),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    }));
  }

  /**
   * Find relevant code for a ticket (convenience method for AI agent).
   */
  async findRelevantForTicket(
    ticketId: string,
    tenantId: string,
    limit: number = 10
  ): Promise<CodeSearchResult[]> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { applicationId: true, title: true, description: true, aiSummary: true },
    });

    if (!ticket?.applicationId) {
      return [];
    }

    // Check if codebase is indexed for this application
    const status = await this.prisma.codebaseIndexStatus.findUnique({
      where: { applicationId: ticket.applicationId },
    });

    if (!status || status.status !== 'indexed') {
      return [];
    }

    // Build search query from ticket content
    const queryParts = [ticket.title, ticket.description, ticket.aiSummary].filter(Boolean);
    if (queryParts.length === 0) {
      return [];
    }

    const query = queryParts.join(' ');
    return this.findRelevantFiles(ticket.applicationId, query, limit);
  }
}
