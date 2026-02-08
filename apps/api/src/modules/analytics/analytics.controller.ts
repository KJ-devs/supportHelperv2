import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  @ApiQuery({ name: 'period', enum: ['day', 'week', 'month'], required: false })
  async getOverview(
    @CurrentTenant() tenantId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
  ) {
    return this.analyticsService.getOverview(tenantId, period);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get ticket trends over time' })
  @ApiQuery({ name: 'period', enum: ['day', 'week', 'month'], required: false })
  @ApiQuery({ name: 'days', type: Number, required: false })
  async getTrends(
    @CurrentTenant() tenantId: string,
    @Query('period') period: 'day' | 'week' | 'month' = 'week',
    @Query('days') days: number = 30,
  ) {
    return this.analyticsService.getTrends(tenantId, period, days);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  async getPerformanceMetrics(@CurrentTenant() tenantId: string) {
    return this.analyticsService.getPerformanceMetrics(tenantId);
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get agent performance statistics' })
  async getAgentStats(@CurrentTenant() tenantId: string) {
    return this.analyticsService.getAgentStats(tenantId);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Get application statistics' })
  async getApplicationStats(@CurrentTenant() tenantId: string) {
    return this.analyticsService.getApplicationStats(tenantId);
  }
}
