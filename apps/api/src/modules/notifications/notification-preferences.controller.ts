import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
} from './dto';

@ApiTags('Notification Preferences')
@ApiBearerAuth()
@Controller('notifications/preferences')
@UseGuards(JwtAuthGuard)
export class NotificationPreferencesController {
  private readonly logger = new Logger(NotificationPreferencesController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all notification preferences for the current tenant' })
  @ApiResponse({ status: 200, description: 'Notification preferences retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentTenant() tenantId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a notification preference' })
  @ApiResponse({ status: 201, description: 'Notification preference created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateNotificationPreferenceDto,
  ) {
    // Verify the application belongs to this tenant
    const app = await this.prisma.application.findFirst({
      where: { id: dto.applicationId, tenantId },
    });
    if (!app) {
      throw new NotFoundException(
        `Application ${dto.applicationId} not found for this tenant`,
      );
    }

    const preference = await this.prisma.notificationPreference.create({
      data: {
        applicationId: dto.applicationId,
        tenantId,
        channel: dto.channel,
        events: dto.events ?? [],
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
        enabled: dto.enabled ?? true,
      },
    });

    this.logger.log(
      `Created notification preference ${preference.id} for app ${dto.applicationId}`,
    );

    return preference;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notification preference' })
  @ApiParam({ name: 'id', type: String, description: 'Preference ID' })
  @ApiResponse({ status: 200, description: 'Notification preference updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    const existing = await this.prisma.notificationPreference.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Notification preference ${id} not found`);
    }

    return this.prisma.notificationPreference.update({
      where: { id },
      data: {
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.config !== undefined && { config: dto.config as Prisma.InputJsonValue }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification preference' })
  @ApiParam({ name: 'id', type: String, description: 'Preference ID' })
  @ApiResponse({ status: 200, description: 'Notification preference deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Preference not found' })
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const existing = await this.prisma.notificationPreference.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Notification preference ${id} not found`);
    }

    await this.prisma.notificationPreference.delete({ where: { id } });

    return { deleted: true };
  }
}
