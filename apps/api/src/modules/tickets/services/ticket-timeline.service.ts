import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TicketsGateway } from '../tickets.gateway';

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
