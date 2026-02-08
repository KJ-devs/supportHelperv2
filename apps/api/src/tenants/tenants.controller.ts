import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant info' })
  async getCurrent(@Request() req: { user: { tenantId: string } }) {
    return this.tenantsService.findOne(req.user.tenantId);
  }

  @Get('current/stats')
  @ApiOperation({ summary: 'Get current tenant stats' })
  async getStats(@Request() req: { user: { tenantId: string } }) {
    return this.tenantsService.getStats(req.user.tenantId);
  }

  @Patch('current')
  @ApiOperation({ summary: 'Update current tenant' })
  async update(
    @Body() data: { name?: string; settings?: Record<string, unknown> },
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.tenantsService.update(req.user.tenantId, data);
  }
}
