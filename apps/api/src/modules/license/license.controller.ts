import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserPayload } from '../../common/interfaces/user-payload.interface';
import { LicenseService } from './license.service';
import {
  UsageResponseDto,
  UsageHistoryResponseDto,
} from './dto/usage.dto';

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

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current usage metrics for authenticated tenant',
  })
  async getUsage(
    @CurrentUser() user: UserPayload,
  ): Promise<UsageResponseDto> {
    const plan = this.licenseService.getPlan();
    const limits = this.licenseService.getPlanLimits();
    const currentUsage = await this.licenseService.getCurrentUsage(
      user.tenantId,
    );
    const alerts = await this.licenseService.getUsageAlerts(user.tenantId);
    const license = this.licenseService.getLicense();

    const metrics = [
      {
        metric: 'tickets',
        current: currentUsage.tickets,
        limit: limits.maxTicketsPerMonth,
        percentage:
          limits.maxTicketsPerMonth > 0
            ? Math.round(
                (currentUsage.tickets / limits.maxTicketsPerMonth) * 100,
              )
            : 0,
      },
      {
        metric: 'agent_tasks',
        current: currentUsage.agent_tasks,
        limit: limits.maxAgentTasksPerMonth,
        percentage:
          limits.maxAgentTasksPerMonth > 0
            ? Math.round(
                (currentUsage.agent_tasks / limits.maxAgentTasksPerMonth) * 100,
              )
            : 0,
      },
      {
        metric: 'users',
        current: currentUsage.users,
        limit: limits.maxUsers,
        percentage:
          limits.maxUsers > 0
            ? Math.round((currentUsage.users / limits.maxUsers) * 100)
            : 0,
      },
      {
        metric: 'repositories',
        current: currentUsage.repositories,
        limit: limits.maxRepos,
        percentage:
          limits.maxRepos > 0
            ? Math.round((currentUsage.repositories / limits.maxRepos) * 100)
            : 0,
      },
    ];

    return {
      plan,
      metrics,
      expiresAt: license?.expiresAt || null,
      alerts,
    };
  }

  @Get('usage/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get monthly usage history for last 6 months',
  })
  async getUsageHistory(
    @CurrentUser() user: UserPayload,
  ): Promise<UsageHistoryResponseDto> {
    return this.licenseService.getUsageHistory(user.tenantId, 6);
  }
}
