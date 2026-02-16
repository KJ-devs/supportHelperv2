import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../common/guards';
import { UpdateTenantDto } from './dto/update-tenant.dto';

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
}
