import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { InternalRoute } from '../../common/decorators/internal-route.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgentTasksService } from './agent-tasks.service';
import { ValidationModeService } from './services/validation-mode.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentTaskResponseDto } from './dto/agent-task-response.dto';
import { ApproveTaskDto, RejectTaskDto } from './dto/review-task.dto';

@ApiTags('Agent Tasks')
@ApiBearerAuth()
@Controller('v1/agent-tasks')
@UseGuards(JwtAuthGuard)
export class AgentTasksController {
  constructor(
    private readonly agentTasksService: AgentTasksService,
    private readonly validationModeService: ValidationModeService,
    private readonly prisma: PrismaService,
    @InjectQueue('agent-orchestration')
    private readonly agentQueue: Queue
  ) {}

  @Post('tickets/:ticketId/analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger code analysis for a ticket' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 202,
    description: 'Agent task created and queued',
    type: AgentTaskResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 400, description: 'Ticket has no linked application' })
  async analyzeTicket(@CurrentTenant() tenantId: string, @Param('ticketId') ticketId: string) {
    // Verify ticket exists and belongs to the tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, applicationId: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    if (!ticket.applicationId) {
      throw new BadRequestException(
        'Ticket has no linked application. An application with a GitHub repository is required for code analysis.'
      );
    }

    // Create the agent task
    const task = await this.agentTasksService.create(ticketId, tenantId, ticket.applicationId);

    // Queue the job
    await this.agentQueue.add(
      'generate-action-plan',
      {
        type: 'generate-action-plan',
        ticketId,
        tenantId,
        applicationId: ticket.applicationId,
        agentTaskId: task.id,
      },
      {
        priority: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      }
    );

    return task;
  }

  @Get('pending-reviews')
  @ApiOperation({ summary: 'List tasks pending review for current tenant' })
  @ApiResponse({ status: 200, description: 'List of tasks pending review' })
  async listPendingReviews(@CurrentTenant() tenantId: string) {
    return this.validationModeService.listPendingReviews(tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get agent task statistics' })
  @ApiResponse({ status: 200, description: 'Agent task stats' })
  async getStats(@CurrentTenant() tenantId: string) {
    return this.agentTasksService.getStats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent task by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent task details', type: AgentTaskResponseDto })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async findById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const task = await this.agentTasksService.findById(id);

    if (task.tenantId !== tenantId) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    return task;
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a task plan or code' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task approved', type: AgentTaskResponseDto })
  @ApiResponse({ status: 400, description: 'Task is not in reviewable status' })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async approve(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ApproveTaskDto
  ) {
    const approvedTask = await this.validationModeService.approveTask(
      id,
      tenantId,
      dto.phase,
      userId
    );

    // After plan approval, queue code generation
    if (dto.phase === 'plan') {
      await this.agentQueue.add(
        'generate-code',
        {
          type: 'generate-code' as const,
          ticketId: approvedTask.ticketId,
          tenantId,
          applicationId: approvedTask.applicationId,
          agentTaskId: id,
        },
        {
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
        }
      );
    }

    // After code approval, queue push/PR creation
    if (dto.phase === 'code') {
      await this.agentQueue.add(
        'push-code',
        {
          type: 'push-code' as const,
          ticketId: approvedTask.ticketId,
          tenantId,
          applicationId: approvedTask.applicationId,
          agentTaskId: id,
        },
        {
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 30000,
          },
        }
      );
    }

    return approvedTask;
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a task plan or code' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Task rejected', type: AgentTaskResponseDto })
  @ApiResponse({ status: 400, description: 'Task is not in reviewable status' })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async reject(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: RejectTaskDto
  ) {
    return this.validationModeService.rejectTask(
      id,
      tenantId,
      dto.phase,
      userId,
      dto.reason,
      dto.iterate
    );
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed agent task' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Task retried successfully',
    type: AgentTaskResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Task cannot be retried' })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async retry(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const task = await this.agentTasksService.findById(id);

    if (task.tenantId !== tenantId) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    if (!['failed', 'expired'].includes(task.status)) {
      throw new BadRequestException(
        `Cannot retry task in '${task.status}' status. Task must be in 'failed' or 'expired' status.`
      );
    }

    const retriedTask = await this.agentTasksService.retry(id);

    // Re-queue the analysis job
    await this.agentQueue.add(
      'generate-action-plan',
      {
        type: 'generate-action-plan',
        ticketId: task.ticketId,
        tenantId,
        applicationId: task.applicationId,
        agentTaskId: id,
      },
      {
        priority: 3,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      }
    );

    return retriedTask;
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an in-progress agent task' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Task cancelled successfully',
    type: AgentTaskResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Task cannot be cancelled' })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async cancel(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    const task = await this.agentTasksService.findById(id);

    if (task.tenantId !== tenantId) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    const terminalStatuses = ['completed', 'failed', 'expired'];
    if (terminalStatuses.includes(task.status)) {
      throw new BadRequestException(
        `Cannot cancel task in '${task.status}' status. Task is already in a terminal state.`
      );
    }

    return this.agentTasksService.cancel(id);
  }

  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'List all agent tasks for a ticket' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'List of agent tasks', type: [AgentTaskResponseDto] })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findByTicketId(@CurrentTenant() tenantId: string, @Param('ticketId') ticketId: string) {
    // Verify ticket exists and belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return this.agentTasksService.findByTicketId(ticketId);
  }

  /**
   * Internal endpoint called by the worker process to append a log entry and
   * emit a real-time WebSocket event. Protected by InternalAuthGuard.
   */
  @Post('internal/:id/log')
  @HttpCode(HttpStatus.OK)
  @InternalRoute()
  @UseGuards(InternalAuthGuard)
  @ApiExcludeEndpoint()
  async internalAppendLog(@Param('id') id: string, @Body() entry: Record<string, unknown>) {
    await this.agentTasksService.appendLog(
      id,
      entry as Parameters<typeof this.agentTasksService.appendLog>[1]
    );
    return { appended: true };
  }

  @Get()
  @ApiOperation({ summary: 'List all agent tasks with filters and pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'applicationId', required: false, description: 'Filter by application' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by ticket severity' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter from date (ISO string)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter to date (ISO string)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in ticket title' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of agent tasks' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('applicationId') applicationId?: string,
    @Query('severity') severity?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    return this.agentTasksService.findAll(tenantId, {
      status,
      applicationId,
      severity,
      dateFrom,
      dateTo,
      search,
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}
