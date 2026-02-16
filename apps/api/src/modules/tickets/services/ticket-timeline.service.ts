import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TicketsGateway } from '../tickets.gateway';
import { NotificationService } from '../../notifications/notification.service';

/** Event types that trigger notifications to configured channels. */
const NOTIFIABLE_EVENTS = new Set([
  'ticket_received',
  'analysis_completed',
  'code_generation_started',
  'pr_created',
  'pr_merged',
  'fix_deployed',
  'ticket_resolved',
]);

export interface TimelineEntry {
  id: string;
  eventType: string;
  data: Record<string, any>;
  createdAt: Date;
  status: 'done' | 'in_progress' | 'failed';
}

@Injectable()
export class TicketTimelineService {
  private readonly logger = new Logger(TicketTimelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsGateway: TicketsGateway,
    @Optional()
    @Inject(NotificationService)
    private readonly notificationService?: NotificationService,
  ) {}

  async recordEvent(
    ticketId: string,
    tenantId: string,
    eventType: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const event = await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        tenantId,
        eventType,
        data: data || {},
      },
    });

    // Push real-time update via WebSocket
    this.ticketsGateway.emitTimelineEvent(tenantId, ticketId, {
      id: event.id,
      eventType,
      data: data || {},
      createdAt: event.createdAt,
    });

    // Dispatch notifications for notifiable events
    if (NOTIFIABLE_EVENTS.has(eventType) && this.notificationService) {
      try {
        const ticket = await this.prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { applicationId: true, title: true },
        });

        if (ticket) {
          await this.notificationService.dispatchNotification({
            ticketId,
            tenantId,
            applicationId: ticket.applicationId,
            eventType,
            data: {
              ...(data || {}),
              ticketId,
              ticketTitle: ticket.title,
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `Failed to dispatch notification for ${eventType} on ticket ${ticketId}: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }
  }

  async getTimeline(
    ticketId: string,
    tenantId: string,
  ): Promise<TimelineEntry[]> {
    const events = await this.prisma.ticketEvent.findMany({
      where: { ticketId, tenantId },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      data: e.data as Record<string, any>,
      createdAt: e.createdAt,
      status: this.inferStatus(e.eventType),
    }));
  }

  private inferStatus(
    eventType: string,
  ): 'done' | 'in_progress' | 'failed' {
    if (eventType.endsWith('_failed') || eventType.endsWith('_error'))
      return 'failed';
    if (eventType.endsWith('_started') || eventType === 'agent_retry')
      return 'in_progress';
    return 'done';
  }
}
