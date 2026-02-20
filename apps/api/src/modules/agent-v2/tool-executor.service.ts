import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CodeInvestigationService, RepoContext } from './code-investigation.service';
import { CodebaseSearchService } from '../codebase-index/services/codebase-search.service';
import { ToolName } from './agent-tools';

export interface ToolExecutionContext {
  repoCtx: RepoContext | null;
  ticket: {
    id: string;
    tenantId: string;
    applicationId: string;
    title?: string | null;
    description?: string | null;
    status?: string;
  };
  tenantId: string;
  applicationId: string;
}

const NO_REPO_ERROR =
  'No repository connected to this application. Connect a GitHub repo in Settings > GitHub.';

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeInvestigation: CodeInvestigationService,
    private readonly codebaseSearch: CodebaseSearchService,
  ) {}

  async execute(
    toolName: ToolName,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const startTime = Date.now();
    try {
      const result = await this.dispatchTool(toolName, input, context);
      this.logger.log(`Tool ${toolName} executed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      this.logger.error(`Tool ${toolName} failed: ${(error as Error).message}`);
      return { error: (error as Error).message || 'Tool execution failed' };
    }
  }

  private async dispatchTool(
    toolName: ToolName,
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    switch (toolName) {
      case 'read_file': {
        if (!context.repoCtx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.readFile(
          context.repoCtx,
          input.file_path as string,
          input.start_line as number | undefined,
          input.end_line as number | undefined,
        );
      }

      case 'list_directory': {
        if (!context.repoCtx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.listDirectory(
          context.repoCtx,
          input.path as string,
          (input.recursive as boolean | undefined) ?? false,
        );
      }

      case 'search_code': {
        if (!context.repoCtx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.searchCode(
          context.repoCtx,
          input.query as string,
          input.file_pattern as string | undefined,
          (input.max_results as number | undefined) ?? 20,
        );
      }

      case 'search_codebase_semantic': {
        return this.codebaseSearch.findRelevantFiles(
          context.applicationId,
          input.query as string,
          (input.limit as number | undefined) ?? 10,
        );
      }

      case 'get_repo_structure': {
        if (!context.repoCtx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.getRepoStructure(
          context.repoCtx,
          (input.max_depth as number | undefined) ?? 3,
          (input.exclude_patterns as string[] | undefined) ?? [],
        );
      }

      case 'get_file_history': {
        if (!context.repoCtx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.getFileHistory(
          context.repoCtx,
          input.file_path as string,
          (input.limit as number | undefined) ?? 5,
        );
      }

      case 'get_file_blame': {
        if (!context.repoCtx) return { error: NO_REPO_ERROR };
        return this.codeInvestigation.getFileBlame(
          context.repoCtx,
          input.file_path as string,
          input.start_line as number | undefined,
          input.end_line as number | undefined,
        );
      }

      case 'update_diagnosis': {
        // This is a special tool — the result is persisted by DiagnosisService upstream.
        // Here we simply return the input as-is so the caller can capture it from the log.
        return {
          status: 'diagnosis_updated',
          rootCause: input.root_cause,
          confidence: input.confidence,
        };
      }

      case 'search_similar_tickets': {
        return this.searchSimilarTickets(
          input.query as string,
          context.tenantId,
          (input.limit as number | undefined) ?? 5,
        );
      }

      case 'get_ticket_details': {
        return this.prisma.ticket.findFirst({
          where: {
            id: input.ticket_id as string,
            tenantId: context.tenantId,
          },
          include: {
            media: {
              include: {
                videoEvents: true,
              },
            },
            application: true,
          },
        });
      }

      case 'update_ticket_status': {
        return this.prisma.ticket.update({
          where: { id: input.ticket_id as string },
          data: { status: input.status as string },
          select: { id: true, status: true },
        });
      }

      case 'escalate_to_human': {
        const ticketId = input.ticket_id as string;
        const reason = input.reason as string;

        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { status: 'open' },
        });

        const session = await this.prisma.agentSession.findFirst({
          where: { ticketId, ticket: { tenantId: context.tenantId } },
          orderBy: { createdAt: 'desc' },
        });

        if (session) {
          await this.prisma.agentSession.update({
            where: { id: session.id },
            data: {
              status: 'escalated',
              escalationReason: reason,
            },
          });
        }

        return {
          status: 'escalated',
          reason,
          priority: input.priority ?? 'medium',
        };
      }

      default: {
        const exhaustive: never = toolName;
        return { error: `Unknown tool: ${String(exhaustive)}` };
      }
    }
  }

  private async searchSimilarTickets(
    query: string,
    tenantId: string,
    limit: number,
  ): Promise<unknown> {
    // Use pgvector to search similar tickets by embedding
    const results: Array<{
      id: string;
      title: string | null;
      status: string;
      ai_summary: string | null;
      distance: number;
    }> = await this.prisma.$queryRaw`
      SELECT t.id, t.title, t.status, t.ai_summary,
             t.embedding <=> (
               SELECT embedding FROM tickets WHERE id = ${tenantId}::uuid LIMIT 1
             ) AS distance
      FROM tickets t
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t.embedding IS NOT NULL
        AND (t.status = 'resolved' OR t.status = 'closed')
      ORDER BY t.embedding <=> (
        SELECT e FROM (
          SELECT embedding AS e FROM tickets
          WHERE tenant_id = ${tenantId}::uuid
            AND title ILIKE ${'%' + query.substring(0, 50) + '%'}
          LIMIT 1
        ) sub
      )
      LIMIT ${limit}
    `;

    // Fallback: if vector search fails, do text search
    if (!results || results.length === 0) {
      const textResults = await this.prisma.ticket.findMany({
        where: {
          tenantId,
          status: { in: ['resolved', 'closed'] },
          OR: [
            { title: { contains: query.substring(0, 100), mode: 'insensitive' } },
            { description: { contains: query.substring(0, 100), mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          aiSummary: true,
          diagnosis: true,
        },
        take: limit,
      });
      return textResults;
    }

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      aiSummary: r.ai_summary,
      similarity: 1 - r.distance,
    }));
  }
}
