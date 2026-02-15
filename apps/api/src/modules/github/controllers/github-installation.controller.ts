import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { GithubInstallationService } from '../services/github-installation.service';
import { GithubAppService } from '../services/github-app.service';

@ApiTags('GitHub App Installation')
@Controller('github/install')
export class GithubInstallationController {
  private readonly logger = new Logger(GithubInstallationController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly installationService: GithubInstallationService,
    private readonly appService: GithubAppService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get('app.dashboardUrl') || 'http://localhost:3000';
  }

  /**
   * GET /github/install
   * Returns the GitHub App installation URL.
   * The dashboard can redirect the user to this URL.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get GitHub App installation URL' })
  getInstallUrl(@CurrentTenant() tenantId: string) {
    if (!this.appService.isEnabled()) {
      throw new BadRequestException(
        'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY.',
      );
    }

    return {
      url: this.installationService.getInstallUrl(tenantId),
    };
  }

  /**
   * GET /github/install/callback
   * Handle the redirect from GitHub after the user installs the app.
   * GitHub sends `installation_id` and `state` (tenantId) as query params.
   */
  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'GitHub App installation callback' })
  @ApiQuery({ name: 'installation_id', required: true, description: 'GitHub installation ID' })
  @ApiQuery({ name: 'state', required: false, description: 'Tenant ID passed during install' })
  async installCallback(
    @Query('installation_id') installationIdStr: string,
    @Query('state') tenantId: string,
    @Res() res: Response,
  ) {
    if (!installationIdStr) {
      return res.redirect(
        `${this.frontendUrl}/dashboard/github?error=${encodeURIComponent('Missing installation_id')}`,
      );
    }

    if (!tenantId) {
      return res.redirect(
        `${this.frontendUrl}/dashboard/github?error=${encodeURIComponent('Missing tenant context. Please retry installation from the dashboard.')}`,
      );
    }

    const installationId = parseInt(installationIdStr, 10);
    if (isNaN(installationId)) {
      return res.redirect(
        `${this.frontendUrl}/dashboard/github?error=${encodeURIComponent('Invalid installation_id')}`,
      );
    }

    try {
      await this.installationService.handleInstallationCallback(
        installationId,
        tenantId,
      );

      this.logger.log(
        `GitHub App installed: installation=${installationId}, tenant=${tenantId}`,
      );

      return res.redirect(
        `${this.frontendUrl}/dashboard/github?github_app=installed&installation_id=${installationId}`,
      );
    } catch (error) {
      this.logger.error('Installation callback error:', error);

      return res.redirect(
        `${this.frontendUrl}/dashboard/github?error=${encodeURIComponent(error.message || 'Installation failed')}`,
      );
    }
  }

  /**
   * GET /github/install/installations
   * List all GitHub App installations for the current tenant.
   */
  @Get('installations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List GitHub App installations for tenant' })
  async listInstallations(@CurrentTenant() tenantId: string) {
    const installations = await this.installationService.getInstallations(tenantId);

    return installations.map((inst) => ({
      id: inst.id,
      installationId: Number(inst.installationId),
      accountLogin: inst.accountLogin,
      accountType: inst.accountType,
      suspended: !!inst.suspendedAt,
      createdAt: inst.createdAt,
    }));
  }

  /**
   * DELETE /github/install/installations/:id
   * Remove an installation record from the tenant.
   */
  @Delete('installations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a GitHub App installation' })
  @ApiParam({ name: 'id', description: 'Installation record UUID' })
  async removeInstallation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.installationService.removeInstallation(id, tenantId);
  }
}
