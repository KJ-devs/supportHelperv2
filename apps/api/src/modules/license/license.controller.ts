import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
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

  @Get('version')
  @Public()
  @ApiOperation({ summary: 'Get system version and database compatibility' })
  async getVersion() {
    return this.licenseService.getVersionInfo();
  }

  @Get('changelog')
  @Public()
  @ApiOperation({ summary: 'Get latest changelog entry' })
  async getChangelog() {
    return this.licenseService.getLatestChangelog();
  }

  @Post('changelog/dismiss')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss changelog notification for current user' })
  async dismissChangelog(@CurrentUser() user: UserPayload) {
    await this.licenseService.dismissChangelogForUser(user.userId);
    return { success: true };
  }
}
