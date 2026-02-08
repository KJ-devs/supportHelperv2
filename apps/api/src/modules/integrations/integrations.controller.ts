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
  @ApiResponse({ status: 200, description: 'Sync queued' })
  async syncTickets(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() body?: { ticketIds?: string[] },
  ) {
    const integration = await this.integrationsService.findOne(id, tenantId);

    if (body?.ticketIds && body.ticketIds.length > 0) {
      const results = await Promise.all(
        body.ticketIds.map((ticketId) =>
          this.integrationsSyncService.syncTicketToIntegration(ticketId, id, tenantId, { priority: 1 }),
        ),
      );

      return { queued: results.length };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const results = await Promise.all(
      tickets.map((ticket) =>
        this.integrationsSyncService.syncTicketToIntegration(ticket.id, id, tenantId, { priority: 3 }),
      ),
    );

    return { queued: results.length };
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get sync logs for an integration' })
  @ApiResponse({ status: 200, description: 'Sync logs' })
  async getSyncLogs(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.integrationsService.getSyncLogs(
      id,
      tenantId,
      page ? parseInt(page, 10) : 0,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
