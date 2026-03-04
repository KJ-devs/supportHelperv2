import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/dto/update-user.dto';
import { QueueMonitorService } from '../agent/queue-monitor.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AdminController {
  constructor(private readonly queueMonitorService: QueueMonitorService) {}

  @Get('queue-metrics')
  @ApiOperation({ summary: 'Get BullMQ queue metrics (admin only)' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin/owner role required' })
  async getQueueMetrics() {
    return this.queueMonitorService.getMetrics();
  }
}
