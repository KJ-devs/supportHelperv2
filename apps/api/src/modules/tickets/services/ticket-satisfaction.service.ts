import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertSatisfactionInput } from '../dto/satisfaction.dto';

@Injectable()
export class TicketSatisfactionService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    ticketId: string,
    tenantId: string,
    dto: UpsertSatisfactionInput,
  ) {
    // Verify ticket belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return this.prisma.ticketSatisfaction.upsert({
      where: { ticketId },
      create: {
        ticketId,
        rating: dto.rating,
        comment: dto.comment,
      },
      update: {
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  async findByTicket(ticketId: string, tenantId: string) {
    // Verify ticket belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const satisfaction = await this.prisma.ticketSatisfaction.findUnique({
      where: { ticketId },
    });

    return satisfaction;
  }
}
