import {
  Controller,
  Post,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../../../prisma/prisma.service';
import { TicketTimelineService } from '../services/ticket-timeline.service';

@ApiTags('Ticket Reopen')
@Controller('sdk/tickets')
export class TicketReopenController {
  private readonly logger = new Logger(TicketReopenController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketTimelineService: TicketTimelineService,
  ) {}

  @Post(':id/reopen')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reopen a resolved ticket (public, token-based)' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiQuery({ name: 'token', description: 'Reopen token from the resolution email' })
  @ApiResponse({ status: 200, description: 'Ticket reopened successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async reopen(
    @Param('id') id: string,
    @Query('token') token: string,
  ) {
    if (!token) {
      throw new BadRequestException('Reopen token is required');
    }

    // 1. Find ticket and validate token
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.reopenToken !== token) {
      throw new BadRequestException('Invalid or expired reopen token');
    }

    // 2. Check status is reopenable
    const reopenableStatuses = ['merged', 'resolved', 'closed'];
    if (!reopenableStatuses.includes(ticket.status)) {
      throw new BadRequestException(
        `Ticket cannot be reopened from status "${ticket.status}"`,
      );
    }

    // 3. Update ticket: reopen and clear token
    await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id },
        data: {
          status: 'open',
          reopenToken: null,
          resolvedAt: null,
        },
      }),
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          type: 'user',
          content: 'Client reports the issue persists after resolution.',
          sender: 'client',
        },
      }),
    ]);

    // 4. Record timeline event
    await this.ticketTimelineService.recordEvent(
      id,
      ticket.tenantId,
      'ticket_reopened',
      { previousStatus: ticket.status },
    );

    this.logger.log(`Ticket ${id} reopened by client`);

    return {
      success: true,
      ticketId: id,
      status: 'open',
      message: 'Your ticket has been reopened. Our team will look into it.',
    };
  }
}
