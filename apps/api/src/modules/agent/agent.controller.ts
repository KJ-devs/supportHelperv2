import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('AI Agent')
@ApiBearerAuth()
@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('sessions/:ticketId')
  @ApiOperation({ summary: 'Start AI agent session for ticket' })
  @ApiParam({ name: 'ticketId', type: String, description: 'Ticket ID to start a session for' })
  @ApiResponse({ status: 201, description: 'Agent session started successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async startSession(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.agentService.startSession(ticketId, tenantId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get agent session with messages' })
  @ApiParam({ name: 'sessionId', type: String, description: 'Agent session ID' })
  @ApiResponse({ status: 200, description: 'Session retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.agentService.getSession(sessionId, tenantId);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send message to agent' })
  @ApiParam({ name: 'sessionId', type: String, description: 'Agent session ID' })
  @ApiResponse({ status: 201, description: 'Message sent and agent response received' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async sendMessage(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.agentService.sendMessage(
      sessionId,
      tenantId,
      dto.content,
      userId,
    );
  }
}
