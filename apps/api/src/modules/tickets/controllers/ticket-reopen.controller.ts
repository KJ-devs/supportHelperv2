import {
  Controller,
  Post,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Ticket Reopen')
@Controller('sdk/tickets')
export class TicketReopenController {
  private readonly logger = new Logger(TicketReopenController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post(':id/reopen')
  @Public()
  @Throttle({ public: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Reopen a resolved ticket (public, token-based auth)',
  })
  @ApiParam({ name: 'id', description: 'Ticket ID', type: 'string' })
  @ApiQuery({ name: 'token', description: 'Reopen token', type: 'string' })
  @ApiResponse({ status: 200, description: 'Ticket reopened successfully' })
  @ApiResponse({ status: 400, description: 'Missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Ticket not found or token mismatch' })
  async reopen(
    @Param('id') id: string,
    @Query('token') token: string,
  ) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    // Look up ticket by id and validate reopenToken
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        reopenToken: true,
        status: true,
        tenantId: true,
      },
    });

    if (!ticket || ticket.reopenToken !== token) {
      throw new NotFoundException(
        'Ticket not found or reopen token is invalid',
      );
    }

    // Only allow reopening merged/resolved/closed tickets
    const reopenableStatuses = ['merged', 'resolved', 'closed'];
    if (!reopenableStatuses.includes(ticket.status)) {
      throw new BadRequestException(
        `Ticket is currently "${ticket.status}" and cannot be reopened`,
      );
    }

    // Reopen the ticket
    await this.prisma.$transaction([
      // Update ticket status
      this.prisma.ticket.update({
        where: { id },
        data: {
          status: 'open',
          reopenToken: null, // Invalidate the token after use
          resolvedAt: null,
        },
      }),
      // Create a ticket message recording the reopen
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          type: 'user',
          content: 'Client reports issue persists after resolution.',
          sender: 'client',
          metadata: {
            reopenedAt: new Date().toISOString(),
            previousStatus: ticket.status,
          },
        },
      }),
      // Record timeline event
      this.prisma.ticketEvent.create({
        data: {
          ticketId: id,
          tenantId: ticket.tenantId,
          eventType: 'ticket_reopened',
          data: {
            previousStatus: ticket.status,
            reason: 'Client reports issue persists',
          },
        },
      }),
    ]);

    this.logger.log(`Ticket ${id} reopened by client via reopen token`);

    return {
      success: true,
      message: 'Ticket reopened. Our team has been notified and will follow up.',
    };
  }
}
