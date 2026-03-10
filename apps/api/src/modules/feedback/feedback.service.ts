import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassificationFeedback } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateFeedbackDto) {
    // Verify ticket belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: dto.ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Upsert: update existing record for same ticket+field, or create a new one
    const existing = await this.prisma.classificationFeedback.findFirst({
      where: { ticketId: dto.ticketId, field: dto.field },
    });

    if (existing) {
      return this.prisma.classificationFeedback.update({
        where: { id: existing.id },
        data: {
          originalValue: dto.originalValue,
          correctedValue: dto.correctedValue,
          correctedBy: userId,
        },
      });
    }

    return this.prisma.classificationFeedback.create({
      data: {
        ticketId: dto.ticketId,
        field: dto.field,
        originalValue: dto.originalValue,
        correctedValue: dto.correctedValue,
        correctedBy: userId,
      },
    });
  }

  async findByTicket(ticketId: string, tenantId: string) {
    // Verify ticket belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.prisma.classificationFeedback.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const feedback = await this.prisma.classificationFeedback.findFirst({
      where: {
        id,
        ticket: { tenantId },
      },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    return feedback;
  }

  async update(id: string, tenantId: string, dto: UpdateFeedbackDto) {
    await this.findOne(id, tenantId);

    return this.prisma.classificationFeedback.update({
      where: { id },
      data: {
        originalValue: dto.originalValue,
        correctedValue: dto.correctedValue,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.classificationFeedback.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Fetch all feedback corrections for a set of ticket IDs, most recent first.
   * Used by the triage pipeline to inject human corrections as context signals.
   */
  async findByTicketIds(ticketIds: string[]): Promise<ClassificationFeedback[]> {
    if (ticketIds.length === 0) return [];

    return this.prisma.classificationFeedback.findMany({
      where: { ticketId: { in: ticketIds } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
