import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { TicketsSearchService } from './tickets-search.service';
import { TicketsAIService } from './tickets-ai.service';
import { TicketsGateway } from './tickets.gateway';
import { IntegrationsSyncService } from '../integrations/integrations-sync.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  FilterTicketsDto,
  SearchTicketsDto,
  AssignTicketDto,
  createTicketSchema,
  updateTicketSchema,
  filterTicketsSchema,
  searchTicketsSchema,
  assignTicketSchema,
} from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly ticketsSearchService: TicketsSearchService,
    private readonly ticketsAIService: TicketsAIService,
    private readonly integrationsSyncService: IntegrationsSyncService,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createTicketSchema))
    createTicketDto: CreateTicketDto,
  ) {
    const ticket = await this.ticketsService.create(
      tenantId,
      createTicketDto,
      userId,
    );

    // Index in Meilisearch
    if (this.ticketsSearchService.isEnabled()) {
      await this.ticketsSearchService.indexTicket(ticket);
    }

    // Enqueue AI analysis
    await this.ticketsAIService.enqueueAnalysis(ticket.id);

    // Trigger integration syncs
    await this.integrationsSyncService.syncTicketToAllEnabledIntegrations(ticket.id, tenantId, { priority: 2 });

    // Emit real-time event
    this.ticketsGateway.emitTicketCreated(tenantId, ticket);

    return ticket;
  }

  @Get()
  @ApiOperation({ summary: 'Get all tickets with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(filterTicketsSchema))
    filterDto: FilterTicketsDto,
  ) {
    return this.ticketsService.findAll(tenantId, filterDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get ticket statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@CurrentTenant() tenantId: string) {
    return this.ticketsService.getStats(tenantId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search tickets using Meilisearch' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(searchTicketsSchema))
    searchDto: SearchTicketsDto,
  ) {
    return this.ticketsSearchService.search(tenantId, searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.ticketsService.findOne(id, tenantId);
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Find similar tickets using vector search' })
  @ApiResponse({ status: 200, description: 'Similar tickets retrieved' })
  async findSimilar(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit: number = 5,
  ) {
    return this.ticketsAIService.findSimilar(id, tenantId, limit);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTicketSchema))
    updateTicketDto: UpdateTicketDto,
  ) {
    const ticket = await this.ticketsService.update(
      id,
      tenantId,
      updateTicketDto,
    );

    // Update in Meilisearch
    if (this.ticketsSearchService.isEnabled()) {
      await this.ticketsSearchService.updateTicket(ticket);
    }

    // Sync updates to integrations
    await this.integrationsSyncService.syncTicketToAllEnabledIntegrations(id, tenantId, { action: 'update' });

    // Emit real-time event
    this.ticketsGateway.emitTicketUpdated(tenantId, ticket);

    return ticket;
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign ticket to a user' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  async assign(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignTicketSchema))
    assignDto: AssignTicketDto,
  ) {
    const ticket = await this.ticketsService.assign(id, tenantId, assignDto.userId);

    // Emit real-time event
    this.ticketsGateway.emitTicketAssigned(tenantId, ticket);

    return ticket;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a ticket (soft delete)' })
  @ApiResponse({ status: 200, description: 'Ticket deleted successfully' })
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    // Sync deletions to integrations BEFORE deleting the ticket
    await this.integrationsSyncService.deleteTicketFromAllIntegrations(id, tenantId);

    const ticket = await this.ticketsService.remove(id, tenantId);

    // Remove from Meilisearch
    if (this.ticketsSearchService.isEnabled()) {
      await this.ticketsSearchService.removeTicket(id);
    }

    // Emit real-time event
    this.ticketsGateway.emitTicketDeleted(tenantId, id);

    return ticket;
  }
}
