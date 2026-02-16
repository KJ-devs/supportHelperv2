import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserPayload } from '../../common/interfaces/user-payload.interface';
import { LicenseService } from './license.service';

@ApiTags('System')
@Controller('system')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('license')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get license information and usage for tenant' })
  async getLicenseInfo(@CurrentUser() user: UserPayload) {
    const plan = this.licenseService.getPlan();
    const limits = this.licenseService.getPlanLimits();
    const usage = await this.licenseService.getUsageSummary(user.tenantId);
    const license = this.licenseService.getLicense();

    return {
      plan,
      limits,
      usage,
      expiresAt: license?.expiresAt || null,
      valid: license !== null,
    };
  }
}
