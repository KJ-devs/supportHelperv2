import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { DeepAnalysisService } from './deep-analysis.service';
import { DiagnosisService } from './diagnosis.service';

class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;
}

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

class InternalAnalyzeDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;
}

@ApiTags('AI Agent V2')
@ApiBearerAuth()
@Controller('agent/v2')
@UseGuards(JwtAuthGuard)
export class AgentV2Controller {
  constructor(
    private readonly deepAnalysis: DeepAnalysisService,
    private readonly diagnosisService: DiagnosisService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new agent V2 session for a ticket' })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async createSession(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateSessionDto,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: dto.ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const session = await this.prisma.agentSession.create({
      data: {
        ticketId: dto.ticketId,
        status: 'analyzing',
        agentState: { version: 'v2', step: 'initial' },
      },
    });

    return { sessionId: session.id, status: session.status };
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send a message to the agent and get a response' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiResponse({ status: 201, description: 'Agent response' })
  async sendMessage(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.deepAnalysis.handleUserMessage(sessionId, dto.content, tenantId, userId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get session info and diagnosis' })
  @ApiParam({ name: 'sessionId', type: String })
  async getSession(
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const session = await this.prisma.agentSession.findFirst({
      where: { id: sessionId, ticket: { tenantId } },
      include: { ticket: { select: { id: true, title: true, diagnosis: true } } },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  @Get('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Get all messages for a session' })
  @ApiParam({ name: 'sessionId', type: String })
  async getMessages(
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    const session = await this.prisma.agentSession.findFirst({
      where: { id: sessionId, ticket: { tenantId } },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const messages = await this.prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((msg) => {
      const meta = msg.metadata as Record<string, unknown> | null;
      return {
        ...msg,
        toolsUsed: (meta?.['toolsUsed'] as string[] | undefined) ?? [],
      };
    });
  }

  @Get('tickets/:ticketId/session')
  @ApiOperation({ summary: 'Get the most recent agent V2 session for a ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  @ApiResponse({ status: 200, description: 'Session found' })
  @ApiResponse({ status: 404, description: 'No session found for this ticket' })
  async getTicketSession(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const session = await this.prisma.agentSession.findFirst({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new NotFoundException('No session found for this ticket');
    }

    return { sessionId: session.id, status: session.status };
  }

  @Get('tickets/:ticketId/diagnosis')
  @ApiOperation({ summary: 'Get the AI diagnosis for a ticket' })
  @ApiParam({ name: 'ticketId', type: String })
  async getDiagnosis(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, diagnosis: true, diagnosisUpdatedAt: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ticketId: ticket.id,
      diagnosis: ticket.diagnosis,
      updatedAt: ticket.diagnosisUpdatedAt,
    };
  }

  /**
   * Internal endpoint called by the worker process to trigger deep analysis.
   * Protected by a shared secret header (INTERNAL_API_SECRET) — not exposed in Swagger.
   */
  @Post('internal/analyze')
  @Public()
  @ApiExcludeEndpoint()
  async internalAnalyze(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body() dto: InternalAnalyzeDto,
  ) {
    const expectedSecret = this.configService.get<string>('INTERNAL_API_SECRET');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid internal secret');
    }

    const diagnosis = await this.deepAnalysis.analyze(dto.ticketId, dto.tenantId);
    return {
      ticketId: dto.ticketId,
      diagnosisFound: diagnosis !== null,
      diagnosis,
    };
  }
}
