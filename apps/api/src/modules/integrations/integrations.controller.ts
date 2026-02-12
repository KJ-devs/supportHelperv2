import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { IntegrationsSyncService } from './integrations-sync.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createIntegrationSchema, updateIntegrationSchema } from './dto';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly integrationsSyncService: IntegrationsSyncService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createIntegrationSchema)) dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all integrations' })
  @ApiResponse({ status: 200, description: 'Integrations list' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
    @Query('enabled') enabled?: string,
  ) {
    return this.integrationsService.findAll(tenantId, {
      type,
      enabled: enabled !== undefined ? enabled === 'true' : undefined,
    });
  }

  @Get('types')
  @ApiOperation({ summary: 'Get available integration types' })
  @ApiResponse({ status: 200, description: 'Available types' })
  async getTypes() {
    return this.integrationsService.getAvailableTypes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration details' })
  @ApiResponse({ status: 200, description: 'Integration details' })
  async findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.integrationsService.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an integration' })
  @ApiResponse({ status: 200, description: 'Integration updated' })
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateIntegrationSchema)) dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an integration' })
  @ApiResponse({ status: 204, description: 'Integration deleted' })
  async delete(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    await this.integrationsService.delete(id, tenantId);
    return { success: true };
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test integration connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.integrationsService.testConnection(id, tenantId);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Manually trigger sync for all tickets' })
  @ApiResponse({ status: 200, description: 'Sync queued with smart deduplication' })
  async syncTickets(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() body?: { ticketIds?: string[] },
  ) {
    const integration = await this.integrationsService.findOne(id, tenantId);

    // Handle specific ticket IDs sync (no smart filtering for targeted syncs)
    if (body?.ticketIds && body.ticketIds.length > 0) {
      const results = await Promise.all(
        body.ticketIds.map((ticketId) =>
          this.integrationsSyncService.syncTicketToIntegration(ticketId, id, tenantId, { priority: 1 }),
        ),
      );

      return { queued: results.length };
    }

    // Smart resync: Only queue tickets that haven't been successfully synced yet
    // This prevents re-syncing all 173+ tickets when only a few failed
    
    // Step 1: Get all tickets for this tenant
    const allTickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const totalTickets = allTickets.length;

    // Step 2: Find tickets with successful sync logs (with externalId)
    // We use a raw query for better performance when dealing with large datasets
    const successfullySyncedTickets = await this.prisma.integrationSyncLog.findMany({
      where: {
        integrationId: id,
        status: 'success',
        externalId: { not: null },
      },
      select: {
        ticketId: true,
        externalId: true,
      },
      distinct: ['ticketId'],
    });

    // Create a Set for O(1) lookup performance
    const syncedTicketIds = new Set(successfullySyncedTickets.map(log => log.ticketId));

    // Step 3: Filter tickets that need syncing
    // Include tickets that:
    // - Have never been synced (not in syncedTicketIds)
    // - OR have no successful sync with externalId
    const ticketsToSync = allTickets.filter(ticket => !syncedTicketIds.has(ticket.id));

    // Step 4: Queue the filtered tickets
    const results = await Promise.all(
      ticketsToSync.map((ticket) =>
        this.integrationsSyncService.syncTicketToIntegration(ticket.id, id, tenantId, { priority: 3 }),
      ),
    );

    const alreadySynced = totalTickets - ticketsToSync.length;
    const queued = ticketsToSync.length;

    this.logger.log(
      `Smart resync for integration ${id}: ${totalTickets} total tickets, ` +
      `${alreadySynced} already synced, ${queued} queued for sync`
    );

    return {
      total: totalTickets,
      alreadySynced,
      queued,
      skipped: alreadySynced,
    };
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get sync logs for an integration' })
  @ApiResponse({ status: 200, description: 'Sync logs' })
  async getSyncLogs(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('action') action?: string,
    @Query('triggeredBy') triggeredBy?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.integrationsService.getSyncLogs(id, tenantId, {
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      action,
      triggeredBy,
      from,
      to,
    });
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get sync statistics for an integration' })
  @ApiResponse({ status: 200, description: 'Sync statistics' })
  async getSyncStats(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.integrationsService.getSyncStats(id, tenantId);
  }
}
