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
  @ApiOperation({ summary: 'Manually trigger sync (push, pull, or both)' })
  @ApiResponse({ status: 200, description: 'Sync queued with smart deduplication' })
  async syncTickets(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() body?: { ticketIds?: string[]; direction?: 'push' | 'pull' | 'both'; applicationId?: string },
  ) {
    await this.integrationsService.findOne(id, tenantId);
    const direction = body?.direction || 'push';
    let pushResult = { total: 0, alreadySynced: 0, queued: 0 };
    let pullQueued = 0;

    if (direction === 'push' || direction === 'both') {
      if (body?.ticketIds && body.ticketIds.length > 0) {
        const results = await Promise.all(
          body.ticketIds.map((ticketId) =>
            this.integrationsSyncService.syncTicketToIntegration(ticketId, id, tenantId, { priority: 1 }),
          ),
        );
        pushResult = { total: results.length, alreadySynced: 0, queued: results.length };
      } else {
        const allTickets = await this.prisma.ticket.findMany({
          where: { tenantId },
          select: { id: true },
        });

        const successfullySyncedTickets = await this.prisma.integrationSyncLog.findMany({
          where: {
            integrationId: id,
            status: 'success',
            externalId: { not: null },
          },
          select: { ticketId: true },
          distinct: ['ticketId'],
        });

        const syncedTicketIds = new Set(successfullySyncedTickets.map(log => log.ticketId));
        const ticketsToSync = allTickets.filter(ticket => !syncedTicketIds.has(ticket.id));

        await Promise.all(
          ticketsToSync.map((ticket) =>
            this.integrationsSyncService.syncTicketToIntegration(ticket.id, id, tenantId, { priority: 3 }),
          ),
        );

        pushResult = {
          total: allTickets.length,
          alreadySynced: allTickets.length - ticketsToSync.length,
          queued: ticketsToSync.length,
        };

        this.logger.log(
          `Smart resync for integration ${id}: ${pushResult.total} total, ${pushResult.alreadySynced} already synced, ${pushResult.queued} queued`,
        );
      }
    }

    if (direction === 'pull' || direction === 'both') {
      let applicationId = body?.applicationId;

      if (!applicationId) {
        const firstApp = await this.prisma.application.findFirst({
          where: { tenantId },
          select: { id: true },
        });
        applicationId = firstApp?.id;
      }

      if (!applicationId) {
        return {
          ...pushResult,
          pulled: 0,
          skipped: pushResult.alreadySynced,
          error: 'No application found for this tenant',
        };
      }

      await this.integrationsSyncService.pullTicketsFromIntegration(id, tenantId, applicationId);
      pullQueued = 1;
    }

    return {
      total: pushResult.total,
      alreadySynced: pushResult.alreadySynced,
      queued: pushResult.queued + pullQueued,
      skipped: pushResult.alreadySynced,
      pushed: pushResult.queued,
      pulled: pullQueued,
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
