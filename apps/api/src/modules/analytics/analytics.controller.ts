import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AnalyticsQueryDto, AnalyticsPeriod } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'], description: 'Time period for aggregation (default: week)' })
  @ApiResponse({ status: 200, description: 'Overview statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOverview(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOverview(tenantId, query.period || AnalyticsPeriod.WEEK);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get ticket trends over time' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'], description: 'Time period for aggregation (default: week)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 30, min: 1, max: 365)' })
  @ApiResponse({ status: 200, description: 'Trend data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTrends(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTrends(
      tenantId,
      query.period || AnalyticsPeriod.WEEK,
      query.days || 30,
    );
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPerformanceMetrics(@CurrentTenant() tenantId: string) {
    return this.analyticsService.getPerformanceMetrics(tenantId);
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get agent performance statistics' })
  @ApiResponse({ status: 200, description: 'Agent statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAgentStats(@CurrentTenant() tenantId: string) {
    return this.analyticsService.getAgentStats(tenantId);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Get application statistics' })
  @ApiResponse({ status: 200, description: 'Application statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getApplicationStats(@CurrentTenant() tenantId: string) {
    return this.analyticsService.getApplicationStats(tenantId);
  }
}
