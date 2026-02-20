import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TicketMessagesService {
  private readonly logger = new Logger(TicketMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listMessages(
    ticketId: string,
    tenantId: string,
    options?: { parentId?: string; limit?: number; cursor?: string },
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

    const where = {
      ticketId,
      parentId: options?.parentId ?? null,
    };

    const messages = await this.prisma.ticketMessage.findMany({
      where,
      include: {
        replies: {
          orderBy: { createdAt: 'asc' as const },
          take: 3,
        },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'asc' as const },
      take: options?.limit ?? 50,
      ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    return messages;
  }

  async createMessage(
    ticketId: string,
    tenantId: string,
    data: {
      type: string;
      content: string;
      sender: string;
      parentId?: string;
      metadata?: Record<string, unknown>;
      actionState?: string;
    },
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId,
        type: data.type,
        content: data.content,
        sender: data.sender,
        parentId: data.parentId || null,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : {},
        actionState: data.actionState || null,
      },
    });

    this.eventEmitter.emit('ticket:new-message', {
      ticketId,
      message,
    });

    this.logger.log(`Message created for ticket ${ticketId}`);

    return message;
  }

  async updateActionState(
    messageId: string,
    tenantId: string,
    actionState: 'approved' | 'rejected',
  ) {
    const message = await this.prisma.ticketMessage.findFirst({
      where: { id: messageId, ticket: { tenantId } },
    });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    const updated = await this.prisma.ticketMessage.update({
      where: { id: messageId },
      data: { actionState },
    });

    this.eventEmitter.emit('ticket:message-action', {
      ticketId: message.ticketId,
      messageId,
      actionState,
    });

    this.logger.log(`Message ${messageId} action state updated to ${actionState}`);

    return updated;
  }
}
