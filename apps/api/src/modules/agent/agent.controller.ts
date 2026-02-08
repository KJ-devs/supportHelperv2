import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  async startSession(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.agentService.startSession(ticketId, tenantId);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get agent session with messages' })
  async getSession(
    @CurrentTenant() tenantId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.agentService.getSession(sessionId, tenantId);
  }

  @Post('sessions/:sessionId/messages')
  @ApiOperation({ summary: 'Send message to agent' })
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
