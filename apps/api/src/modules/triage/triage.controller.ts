import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { TriageService } from './triage.service';

class InternalTriageDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  skipClassification?: boolean;
}

@ApiTags('Triage')
@ApiBearerAuth()
@Controller('triage')
@UseGuards(JwtAuthGuard)
export class TriageController {
  constructor(
    private readonly triageService: TriageService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('triage') private readonly triageQueue: Queue,
  ) {}

  /**
   * Internal endpoint called by the worker process.
   * Protected by shared secret header.
   */
  @Post('internal/run')
  @Public()
  @ApiExcludeEndpoint()
  async internalRun(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body() dto: InternalTriageDto,
  ) {
    const expectedSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    return this.triageService.runTriage(
      dto.ticketId,
      dto.tenantId,
      dto.applicationId,
      {
        skipClassification: dto.skipClassification,
        source: dto.source,
      },
    );
  }

  /**
   * Manually re-trigger triage for a ticket (dashboard users).
   */
  @Post(':ticketId/re-triage')
  @ApiOperation({ summary: 'Re-trigger triage for a ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiResponse({ status: 201, description: 'Triage job enqueued' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async reTriage(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, applicationId: true },
    });

    if (!ticket || !ticket.applicationId) {
      throw new NotFoundException('Ticket not found or has no application');
    }

    await this.triageQueue.add(
      'triage',
      {
        ticketId: ticket.id,
        tenantId,
        applicationId: ticket.applicationId,
        source: 'manual',
      },
      {
        priority: 2,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { message: 'Triage job enqueued', ticketId };
  }

  /**
   * Get the triage result for a ticket from the latest triage timeline event.
   */
  @Get(':ticketId/result')
  @ApiOperation({ summary: 'Get triage result for a ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiResponse({ status: 200, description: 'Triage result' })
  @ApiResponse({ status: 404, description: 'Ticket or triage result not found' })
  async getTriageResult(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: {
        id: true,
        type: true,
        typeConfidence: true,
        severity: true,
        severityConfidence: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const triageEvent = await this.prisma.ticketEvent.findFirst({
      where: { ticketId, eventType: 'triage_completed' },
      orderBy: { createdAt: 'desc' },
      select: { data: true, createdAt: true },
    });

    return {
      ticketId: ticket.id,
      classification: {
        type: ticket.type,
        typeConfidence: ticket.typeConfidence ? Number(ticket.typeConfidence) : null,
        severity: ticket.severity,
        severityConfidence: ticket.severityConfidence
          ? Number(ticket.severityConfidence)
          : null,
      },
      triageDetails: triageEvent?.data || null,
      triagedAt: triageEvent?.createdAt || null,
    };
  }
}
