import { Controller, Get, Patch, Post, Body, UseGuards, Request, Param, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateRateLimitsDto } from './dto/update-rate-limits.dto';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant info' })
  @ApiResponse({ status: 200, description: 'Tenant info retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrent(@Request() req: { user: { tenantId: string } }) {
    return this.tenantsService.findOne(req.user.tenantId);
  }

  @Get('current/stats')
  @ApiOperation({ summary: 'Get current tenant stats' })
  @ApiResponse({ status: 200, description: 'Tenant statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Request() req: { user: { tenantId: string } }) {
    return this.tenantsService.getStats(req.user.tenantId);
  }

  @Patch('current')
  @ApiOperation({ summary: 'Update current tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Body() dto: UpdateTenantDto,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.tenantsService.update(req.user.tenantId, dto);
  }

  @Get('current/rate-limits')
  @ApiOperation({ summary: 'Get current tenant rate limits' })
  @ApiResponse({ status: 200, description: 'Rate limits retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRateLimits(@Request() req: { user: { tenantId: string } }) {
    return this.tenantsService.getRateLimits(req.user.tenantId);
  }

  @Patch(':id/rate-limits')
  @ApiOperation({ summary: 'Update tenant rate limits (Admin only)' })
  @ApiResponse({ status: 200, description: 'Rate limits updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async updateRateLimits(
    @Param('id') tenantId: string,
    @Body() dto: UpdateRateLimitsDto,
    @Request() req: { user: { tenantId: string; role: string } }
  ) {
    // Only allow owner/admin users OR users updating their own tenant
    if (req.user.role !== 'owner' && req.user.role !== 'admin' && req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Only admin users can update rate limits for other tenants');
    }

    return this.tenantsService.updateRateLimits(tenantId, dto);
  }

  @Post(':id/rate-limits/reset')
  @ApiOperation({ summary: 'Reset tenant rate limits to plan defaults (Admin only)' })
  @ApiResponse({ status: 200, description: 'Rate limits reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  async resetRateLimits(
    @Param('id') tenantId: string,
    @Request() req: { user: { tenantId: string; role: string } }
  ) {
    // Only allow owner/admin users OR users resetting their own tenant
    if (req.user.role !== 'owner' && req.user.role !== 'admin' && req.user.tenantId !== tenantId) {
      throw new ForbiddenException('Only admin users can reset rate limits for other tenants');
    }

    return this.tenantsService.resetRateLimits(tenantId);
  }
}
