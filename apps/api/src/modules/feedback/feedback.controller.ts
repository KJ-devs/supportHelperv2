import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Classification Feedback')
@ApiBearerAuth()
@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Throttle({ authenticated: { limit: 50, ttl: 3600000 } })
  @ApiOperation({ summary: 'Create classification feedback for a ticket' })
  @ApiResponse({ status: 201, description: 'Feedback created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid field or correctedValue' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateFeedbackDto,
    @Request() req: { user: { id: string } }
  ) {
    return this.feedbackService.create(tenantId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List feedback for a ticket' })
  @ApiQuery({
    name: 'ticketId',
    required: true,
    type: String,
    description: 'Ticket ID to retrieve feedback for',
  })
  @ApiResponse({ status: 200, description: 'Feedback list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByTicket(@CurrentTenant() tenantId: string, @Query('ticketId') ticketId: string) {
    return this.feedbackService.findByTicket(ticketId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single feedback by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Feedback ID' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.feedbackService.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feedback' })
  @ApiParam({ name: 'id', type: String, description: 'Feedback ID' })
  @ApiResponse({ status: 200, description: 'Feedback updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto
  ) {
    return this.feedbackService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete feedback' })
  @ApiParam({ name: 'id', type: String, description: 'Feedback ID' })
  @ApiResponse({ status: 200, description: 'Feedback deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.feedbackService.remove(id, tenantId);
  }
}
