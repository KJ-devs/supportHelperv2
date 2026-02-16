import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResolutionSummaryService } from './resolution-summary.service';
import { TicketTimelineService } from './ticket-timeline.service';
import { NotificationService } from '../../notifications/notification.service';

export interface PrDetails {
  prNumber: number;
  prUrl: string | null;
  branchName: string | null;
}

@Injectable()
export class AutoResponseService {
  private readonly logger = new Logger(AutoResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolutionSummaryService: ResolutionSummaryService,
    private readonly ticketTimelineService: TicketTimelineService,
    private readonly notificationService: NotificationService,
  ) {}

  async handleTicketMerged(
    ticketId: string,
    tenantId: string,
    prDetails?: PrDetails,
  ): Promise<void> {
    try {
      // 1. Fetch ticket with agent tasks
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          agentTasks: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!ticket) {
        this.logger.warn(`Ticket ${ticketId} not found for auto-response`);
        return;
      }

      // 2. Build PR details from agent task if not provided
      const effectivePrDetails: PrDetails | undefined = prDetails || (
        ticket.agentTasks[0]
          ? {
              prNumber: ticket.agentTasks[0].prNumber || 0,
              prUrl: ticket.agentTasks[0].prUrl,
              branchName: ticket.agentTasks[0].branchName,
            }
          : undefined
      );

      // 3. Generate AI resolution summary
      const resolutionSummary = await this.resolutionSummaryService.generateResolutionSummary(
        {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          type: ticket.type,
          severity: ticket.severity,
        },
        effectivePrDetails,
      );

      // 4. Generate reopen token
      const reopenToken = randomUUID();

      // 5. Save reopen token + create TicketMessage
      await this.prisma.$transaction([
        this.prisma.ticket.update({
          where: { id: ticketId },
          data: { reopenToken },
        }),
        this.prisma.ticketMessage.create({
          data: {
            ticketId,
            type: 'system',
            content: resolutionSummary.summary,
            sender: 'system',
            metadata: {
              changes: resolutionSummary.changes,
              version: resolutionSummary.version,
              prDetails: effectivePrDetails ? {
                prNumber: effectivePrDetails.prNumber,
                prUrl: effectivePrDetails.prUrl,
                branchName: effectivePrDetails.branchName,
              } : undefined,
            } as any,
          },
        }),
      ]);

      // 6. Dispatch notification
      await this.notificationService.dispatchNotification({
        ticketId,
        tenantId,
        applicationId: ticket.applicationId,
        eventType: 'ticket_resolved',
        data: {
          ticketId,
          ticketTitle: ticket.title,
          publicId: ticket.publicId,
          summary: resolutionSummary.summary,
          changes: resolutionSummary.changes,
          version: resolutionSummary.version,
          reopenToken,
          prUrl: effectivePrDetails?.prUrl,
          prNumber: effectivePrDetails?.prNumber,
        },
      });

      // 7. Record timeline event
      await this.ticketTimelineService.recordEvent(
        ticketId,
        tenantId,
        'resolution_sent',
        {
          summary: resolutionSummary.summary,
          changes: resolutionSummary.changes,
        },
      );

      this.logger.log(`Auto-response sent for ticket ${ticketId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send auto-response for ticket ${ticketId}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }
}
