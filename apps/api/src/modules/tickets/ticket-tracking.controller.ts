import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Ticket Tracking')
@Controller('tickets/track')
export class TicketTrackingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':publicId')
  @ApiOperation({ summary: 'Get public ticket tracking info (no auth required)' })
  @ApiParam({ name: 'publicId', description: 'Public ticket tracking ID' })
  @ApiResponse({ status: 200, description: 'Ticket tracking data' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async track(@Param('publicId') publicId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        title: true,
        status: true,
        type: true,
        severity: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        ticketEvents: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            eventType: true,
            data: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Filter events to only show customer-facing ones
    const customerFacingEvents = [
      'ticket_received',
      'analysis_started',
      'analysis_completed',
      'code_generation_started',
      'code_generation_completed',
      'pr_created',
      'pr_merged',
      'fix_deployed',
      'agent_analysis_started',
      'agent_plan_ready',
      'agent_plan_approved',
    ];

    const filteredEvents = ticket.ticketEvents.filter((e) =>
      customerFacingEvents.includes(e.eventType),
    );

    return {
      ...ticket,
      ticketEvents: filteredEvents,
    };
  }
}
