import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TicketMessagesService } from '../services/ticket-messages.service';
import {
  CreateMessageDto,
  createMessageSchema,
} from '../dto/create-message.dto';
import {
  UpdateMessageActionDto,
  updateMessageActionSchema,
} from '../dto/update-message-action.dto';

@ApiTags('Ticket Messages')
@ApiBearerAuth()
@Controller('v1/tickets/:ticketId/messages')
@UseGuards(JwtAuthGuard)
export class TicketMessagesController {
  constructor(
    private readonly ticketMessagesService: TicketMessagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List messages for a ticket (paginated, with thread support)' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter replies by parent message ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of messages to return (default 50)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor for pagination (message ID)' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async listMessages(
    @Param('ticketId') ticketId: string,
    @CurrentTenant() tenantId: string,
    @Query('parentId') parentId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.ticketMessagesService.listMessages(ticketId, tenantId, {
      parentId,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new message on a ticket' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async createMessage(
    @Param('ticketId') ticketId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createMessageSchema)) body: CreateMessageDto,
  ) {
    return this.ticketMessagesService.createMessage(ticketId, tenantId, {
      type: body.type ?? 'user',
      content: body.content,
      sender: userId,
      parentId: body.parentId,
      metadata: body.metadata,
    });
  }

  @Patch(':messageId/action')
  @ApiOperation({ summary: 'Approve or reject a pending action on a message' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Action state updated successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async updateActionState(
    @Param('messageId') messageId: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateMessageActionSchema)) body: UpdateMessageActionDto,
  ) {
    return this.ticketMessagesService.updateActionState(
      messageId,
      tenantId,
      body.actionState,
    );
  }
}
