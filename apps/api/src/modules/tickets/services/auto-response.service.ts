import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notifications/notification.service';
import { TicketTimelineService } from './ticket-timeline.service';
import {
  ResolutionSummaryService,
  PrDetails,
} from './resolution-summary.service';

@Injectable()
export class AutoResponseService {
  private readonly logger = new Logger(AutoResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolutionSummaryService: ResolutionSummaryService,
    private readonly notificationService: NotificationService,
    private readonly ticketTimelineService: TicketTimelineService,
  ) {}

  /**
   * Handle ticket status change to "merged":
   * 1. Generate AI resolution summary
   * 2. Store a TicketMessage
   * 3. Generate reopenToken
   * 4. Dispatch notification with resolution email
   * 5. Record timeline event
   */
  async handleTicketMerged(
    ticketId: string,
    tenantId: string,
    prDetails?: PrDetails,
  ): Promise<void> {
    this.logger.log(
      `Handling merged status for ticket ${ticketId} in tenant ${tenantId}`,
    );

    // 1. Fetch ticket details
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        application: { select: { id: true, name: true } },
        agentTasks: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            prNumber: true,
            prUrl: true,
            branchName: true,
          },
        },
      },
    });

    if (!ticket) {
      this.logger.warn(`Ticket ${ticketId} not found for tenant ${tenantId}`);
      return;
    }

    // Merge PR details from agent task if not provided
    const mergedPrDetails: PrDetails = {
      ...prDetails,
      prNumber:
        prDetails?.prNumber ?? ticket.agentTasks[0]?.prNumber ?? undefined,
      prUrl: prDetails?.prUrl ?? ticket.agentTasks[0]?.prUrl ?? undefined,
      branchName:
        prDetails?.branchName ??
        ticket.agentTasks[0]?.branchName ??
        undefined,
    };

    // 2. Generate resolution summary
    const summary =
      await this.resolutionSummaryService.generateResolutionSummary(
        ticket,
        mergedPrDetails,
      );

    this.logger.log(
      `Generated resolution summary for ticket ${ticketId}: ${summary.summary.substring(0, 80)}...`,
    );

    // 3. Generate reopen token and save to ticket
    const reopenToken = randomUUID();
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { reopenToken },
    });

    // 4. Store ticket message
    await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        type: 'system',
        content: summary.summary,
        sender: 'ai-agent',
        metadata: {
          changes: summary.changes,
          version: summary.version,
          prNumber: mergedPrDetails.prNumber,
          prUrl: mergedPrDetails.prUrl,
          branchName: mergedPrDetails.branchName,
          generatedAt: new Date().toISOString(),
        } as any,
      },
    });

    // 5. Dispatch notification (email with resolution summary + reopen link)
    try {
      await this.notificationService.dispatchNotification({
        ticketId,
        tenantId,
        applicationId: ticket.applicationId,
        eventType: 'ticket_resolved',
        data: {
          ticketId,
          ticketTitle: ticket.title,
          summary: summary.summary,
          changes: summary.changes,
          version: summary.version,
          reopenToken,
          publicId: ticket.publicId,
          prUrl: mergedPrDetails.prUrl,
          prNumber: mergedPrDetails.prNumber,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to dispatch resolution notification for ticket ${ticketId}: ${
          err instanceof Error ? err.message : 'Unknown'
        }`,
      );
    }

    // 6. Record timeline event
    await this.ticketTimelineService.recordEvent(
      ticketId,
      tenantId,
      'resolution_sent',
      {
        summary: summary.summary,
        changes: summary.changes,
        reopenTokenGenerated: true,
      },
    );

    this.logger.log(
      `Auto-response completed for ticket ${ticketId}`,
    );
  }
}
