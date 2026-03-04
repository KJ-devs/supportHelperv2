import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketRelationType } from '@prisma/client';

interface RelatedTicketFix {
  suggestedFix?: string;
  prUrl?: string;
  prNumber?: number;
}

export interface NormalizedRelation {
  id: string;
  relationType: TicketRelationType;
  direction: 'outgoing' | 'incoming';
  createdBy: string;
  confidence: number | null;
  createdAt: Date;
  relatedTicket: {
    id: string;
    title: string | null;
    status: string;
    severity: string | null;
    type: string | null;
    fix: RelatedTicketFix;
  };
}

@Injectable()
export class TicketRelationsService {
  private readonly logger = new Logger(TicketRelationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRelations(
    ticketId: string,
    tenantId: string,
  ): Promise<NormalizedRelation[]> {
    const [asSource, asTarget] = await Promise.all([
      this.prisma.ticketRelation.findMany({
        where: { sourceTicketId: ticketId, tenantId },
        include: {
          targetTicket: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
              type: true,
              diagnosis: true,
              agentTasks: {
                select: { prUrl: true, prNumber: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.ticketRelation.findMany({
        where: { targetTicketId: ticketId, tenantId },
        include: {
          sourceTicket: {
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
              type: true,
              diagnosis: true,
              agentTasks: {
                select: { prUrl: true, prNumber: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const results: NormalizedRelation[] = [];

    for (const rel of asSource) {
      const ticket = rel.targetTicket;
      results.push({
        id: rel.id,
        relationType: rel.relationType,
        direction: 'outgoing',
        createdBy: rel.createdBy,
        confidence: rel.confidence ? Number(rel.confidence) : null,
        createdAt: rel.createdAt,
        relatedTicket: {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          severity: ticket.severity,
          type: ticket.type,
          fix: this.extractFix(ticket.diagnosis, ticket.agentTasks),
        },
      });
    }

    for (const rel of asTarget) {
      const ticket = rel.sourceTicket;
      results.push({
        id: rel.id,
        relationType: rel.relationType,
        direction: 'incoming',
        createdBy: rel.createdBy,
        confidence: rel.confidence ? Number(rel.confidence) : null,
        createdAt: rel.createdAt,
        relatedTicket: {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          severity: ticket.severity,
          type: ticket.type,
          fix: this.extractFix(ticket.diagnosis, ticket.agentTasks),
        },
      });
    }

    return results;
  }

  async createManual(
    sourceTicketId: string,
    targetTicketId: string,
    relationType: TicketRelationType,
    tenantId: string,
    confidence?: number,
  ) {
    // Verify both tickets belong to the tenant
    const [source, target] = await Promise.all([
      this.prisma.ticket.findFirst({ where: { id: sourceTicketId, tenantId } }),
      this.prisma.ticket.findFirst({ where: { id: targetTicketId, tenantId } }),
    ]);

    if (!source) throw new NotFoundException(`Source ticket ${sourceTicketId} not found`);
    if (!target) throw new NotFoundException(`Target ticket ${targetTicketId} not found`);

    return this.prisma.ticketRelation.create({
      data: {
        tenantId,
        sourceTicketId,
        targetTicketId,
        relationType,
        createdBy: 'manual',
        confidence: confidence ?? null,
      },
    });
  }

  async remove(relationId: string, tenantId: string): Promise<void> {
    const relation = await this.prisma.ticketRelation.findFirst({
      where: { id: relationId, tenantId },
    });

    if (!relation) throw new NotFoundException('Relation not found');

    await this.prisma.ticketRelation.delete({ where: { id: relationId } });
  }

  /**
   * Create relations from N1 assessment data (duplicate + similar tickets).
   * Uses upsert to avoid duplicates on re-triage.
   */
  async createFromN1Assessment(
    ticketId: string,
    tenantId: string,
    assessment: {
      duplicateTicketId?: string;
      similarTicketIds?: string[];
      confidence?: number;
    },
  ): Promise<void> {
    const operations: Promise<unknown>[] = [];

    if (assessment.duplicateTicketId) {
      operations.push(
        this.prisma.ticketRelation.upsert({
          where: {
            sourceTicketId_targetTicketId_relationType: {
              sourceTicketId: ticketId,
              targetTicketId: assessment.duplicateTicketId,
              relationType: 'duplicate',
            },
          },
          create: {
            tenantId,
            sourceTicketId: ticketId,
            targetTicketId: assessment.duplicateTicketId,
            relationType: 'duplicate',
            createdBy: 'ai',
            confidence: assessment.confidence ?? null,
          },
          update: {
            confidence: assessment.confidence ?? null,
          },
        }),
      );
    }

    if (assessment.similarTicketIds?.length) {
      for (const similarId of assessment.similarTicketIds) {
        if (similarId === ticketId) continue;
        operations.push(
          this.prisma.ticketRelation.upsert({
            where: {
              sourceTicketId_targetTicketId_relationType: {
                sourceTicketId: ticketId,
                targetTicketId: similarId,
                relationType: 'similar',
              },
            },
            create: {
              tenantId,
              sourceTicketId: ticketId,
              targetTicketId: similarId,
              relationType: 'similar',
              createdBy: 'ai',
              confidence: assessment.confidence ?? null,
            },
            update: {
              confidence: assessment.confidence ?? null,
            },
          }),
        );
      }
    }

    if (operations.length > 0) {
      await Promise.allSettled(operations);
      this.logger.log(
        `Created/updated ${operations.length} relation(s) for ticket ${ticketId}`,
      );
    }
  }

  private extractFix(
    diagnosis: unknown,
    agentTasks: Array<{ prUrl: string | null; prNumber: number | null }>,
  ): RelatedTicketFix {
    const fix: RelatedTicketFix = {};
    const diag = diagnosis as { suggestedFix?: string } | null;
    if (diag?.suggestedFix) {
      fix.suggestedFix = diag.suggestedFix;
    }
    if (agentTasks.length > 0) {
      const task = agentTasks[0];
      if (task.prUrl) fix.prUrl = task.prUrl;
      if (task.prNumber) fix.prNumber = task.prNumber;
    }
    return fix;
  }
}
