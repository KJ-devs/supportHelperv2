import { Controller, Post, Get, Body, Param, UseGuards, NotFoundException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InternalRoute } from '../../common/decorators/internal-route.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { DeepAnalysisService } from './deep-analysis.service';
import { DiagnosisService } from './diagnosis.service';

class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsOptional()
  @IsIn(['autonomous', 'guided'])
  agentMode?: 'autonomous' | 'guided';
}

class ApproveCheckpointDto {
  @IsOptional()
  @IsString()
  guidance?: string;
}

class RequestPRDto {
  @IsOptional()
  @IsString()
  instructions?: string;
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

  n1Context?: {
    reasoning: string;
    investigationHints?: string[];
    similarTicketIds?: string[];
  };
}

@ApiTags('AI Agent V2')
@ApiBearerAuth()
@Controller('agent/v2')
@UseGuards(JwtAuthGuard)
export class AgentV2Controller {
  constructor(
    private readonly deepAnalysis: DeepAnalysisService,
    private readonly diagnosisService: DiagnosisService,
    private readonly prisma: PrismaService
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new agent V2 session for a ticket' })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async createSession(@CurrentTenant() tenantId: string, @Body() dto: CreateSessionDto) {
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
        agentMode: dto.agentMode ?? 'autonomous',
      },
    });

    return { sessionId: session.id, status: session.status, agentMode: session.agentMode };
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send a message to the agent and get a response' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiResponse({ status: 201, description: 'Agent response' })
  async sendMessage(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto
  ) {
    return this.deepAnalysis.handleUserMessage(sessionId, dto.content, tenantId, userId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get session info and diagnosis' })
  @ApiParam({ name: 'sessionId', type: String })
  async getSession(@CurrentTenant() tenantId: string, @Param('sessionId') sessionId: string) {
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
  async getMessages(@CurrentTenant() tenantId: string, @Param('sessionId') sessionId: string) {
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

    return messages.map(msg => {
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
  async getTicketSession(@CurrentTenant() tenantId: string, @Param('ticketId') ticketId: string) {
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
  async getDiagnosis(@CurrentTenant() tenantId: string, @Param('ticketId') ticketId: string) {
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

  @Post('sessions/:sessionId/approve')
  @ApiOperation({ summary: 'Approve checkpoint and proceed with investigation (guided mode)' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiResponse({ status: 201, description: 'Checkpoint approved, investigation continues' })
  async approveCheckpoint(
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: ApproveCheckpointDto
  ) {
    await this.deepAnalysis.approveCheckpoint(sessionId, tenantId, body.guidance);
    return { sessionId, approved: true };
  }

  @Post('sessions/:sessionId/request-pr')
  @ApiOperation({ summary: 'Request PR creation (guided mode — after investigation)' })
  @ApiParam({ name: 'sessionId', type: String })
  @ApiResponse({ status: 201, description: 'PR creation approved' })
  async requestPR(
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: RequestPRDto
  ) {
    await this.deepAnalysis.requestPR(sessionId, tenantId, body.instructions);
    return { sessionId, prRequested: true };
  }

  /**
   * Internal endpoint called by the worker process to trigger deep analysis.
   * Protected by InternalAuthGuard: requires both a valid x-internal-secret header
   * and a valid service-account JWT in the Authorization header.
   * Not exposed in Swagger.
   */
  @Post('internal/analyze')
  @InternalRoute()
  @UseGuards(InternalAuthGuard)
  @ApiExcludeEndpoint()
  async internalAnalyze(@Body() dto: InternalAnalyzeDto) {
    const diagnosis = await this.deepAnalysis.analyze(dto.ticketId, dto.tenantId, dto.n1Context);
    return {
      ticketId: dto.ticketId,
      diagnosisFound: diagnosis !== null,
      diagnosis,
    };
  }
}
