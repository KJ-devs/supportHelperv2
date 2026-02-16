import {
  Controller,
  Get,
  Post,
  Param,
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
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AgentTasksService } from './agent-tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentTaskResponseDto } from './dto/agent-task-response.dto';

@ApiTags('Agent Tasks')
@ApiBearerAuth()
@Controller('v1/agent-tasks')
@UseGuards(JwtAuthGuard)
export class AgentTasksController {
  constructor(
    private readonly agentTasksService: AgentTasksService,
    private readonly prisma: PrismaService,
    @InjectQueue('agent-orchestration')
    private readonly agentQueue: Queue,
  ) {}

  @Post('tickets/:ticketId/analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger code analysis for a ticket' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 202, description: 'Agent task created and queued', type: AgentTaskResponseDto })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 400, description: 'Ticket has no linked application' })
  async analyzeTicket(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
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
        'Ticket has no linked application. An application with a GitHub repository is required for code analysis.',
      );
    }

    // Create the agent task
    const task = await this.agentTasksService.create(
      ticketId,
      tenantId,
      ticket.applicationId,
    );

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
      },
    );

    return task;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent task by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Agent task details', type: AgentTaskResponseDto })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const task = await this.agentTasksService.findById(id);

    if (task.tenantId !== tenantId) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    return task;
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve an action plan' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Action plan approved', type: AgentTaskResponseDto })
  @ApiResponse({ status: 400, description: 'Task is not in plan_ready status' })
  @ApiResponse({ status: 404, description: 'Agent task not found' })
  async approve(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const task = await this.agentTasksService.findById(id);

    if (task.tenantId !== tenantId) {
      throw new NotFoundException(`Agent task ${id} not found`);
    }

    if (task.status !== 'plan_ready') {
      throw new BadRequestException(
        `Cannot approve task in '${task.status}' status. Task must be in 'plan_ready' status.`,
      );
    }

    return this.agentTasksService.approve(id);
  }

  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'List all agent tasks for a ticket' })
  @ApiParam({ name: 'ticketId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'List of agent tasks', type: [AgentTaskResponseDto] })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findByTicketId(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
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
}
