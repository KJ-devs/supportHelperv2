import {
  Controller,
  Get,
  Delete,
  Query,
  Res,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { GithubOAuthService } from '../services/github-oauth.service';
import { OAuthCallbackQueryDto } from '../dto';

@ApiTags('GitHub OAuth')
@Controller('github/oauth')
export class GithubOAuthController {
  private readonly logger = new Logger(GithubOAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly oauthService: GithubOAuthService,
    private readonly config: ConfigService
  ) {
    this.frontendUrl = this.config.get('app.dashboardUrl') || 'http://localhost:3000';
  }

  /**
   * GET /github/oauth/authorize
   * Initiate GitHub OAuth flow
   */
  @Get('authorize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get GitHub OAuth authorization URL' })
  @ApiQuery({ name: 'redirect', required: false, description: 'Frontend redirect URL after OAuth' })
  authorize(@CurrentTenant() tenantId: string, @Query('redirect') redirect?: string) {
    if (!this.oauthService.isEnabled()) {
      throw new BadRequestException(
        'GitHub integration is not enabled. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file. ' +
        'See https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app for setup instructions.'
      );
    }

    const { url, state } = this.oauthService.getAuthorizationUrl(tenantId, redirect);

    return {
      url,
      state,
    };
  }

  /**
   * GET /github/oauth/callback
   * Handle OAuth callback from GitHub
   * This is called by GitHub after user authorizes
   */
  @Get('callback')
  @Public()
  @ApiOperation({ summary: 'GitHub OAuth callback handler' })
  async callback(@Query() query: OAuthCallbackQueryDto, @Res() res: Response) {
    // Handle OAuth error from GitHub
    if (query.error) {
      this.logger.error(`OAuth error: ${query.error} - ${query.error_description}`);
      return res.redirect(
        `${this.frontendUrl}/dashboard/github?error=${encodeURIComponent(query.error_description || query.error)}`
      );
    }

    try {
      // Verify state token
      const statePayload = this.oauthService.verifyStateToken(query.state);
      const { tenantId, redirectUri } = statePayload;

      // Exchange code for token
      const tokenResponse = await this.oauthService.exchangeCodeForToken(query.code);

      // Get user info to verify token works
      const user = await this.oauthService.getAuthenticatedUser(tokenResponse.access_token);

      this.logger.log(`GitHub OAuth successful for tenant ${tenantId}, user ${user.login}`);

      // Save connection
      await this.oauthService.saveConnection(
        tenantId,
        tokenResponse.access_token,
        BigInt(user.id),
        tokenResponse.refresh_token,
        tokenResponse.expires_in
      );

      // Redirect to frontend success page
      const redirectUrl = redirectUri || `${this.frontendUrl}/dashboard/github`;
      return res.redirect(`${redirectUrl}?github=connected&user=${user.login}`);
    } catch (error) {
      this.logger.error('OAuth callback error:', error);

      return res.redirect(
        `${this.frontendUrl}/dashboard/github?error=${encodeURIComponent('GitHub connection failed')}`
      );
    }
  }

  /**
   * GET /github/oauth/status
   * Check GitHub connection status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check GitHub connection status' })
  async status(@CurrentTenant() tenantId: string) {
    const connection = await this.oauthService.getConnection(tenantId);

    if (!connection) {
      return {
        connected: false,
      };
    }

    return {
      connected: true,
      connectionId: connection.id,
      repoCount: (connection.repos as string[])?.length || 0,
      createdAt: connection.createdAt,
    };
  }

  /**
   * DELETE /github/oauth/disconnect
   * Disconnect GitHub integration
   */
  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect GitHub integration' })
  async disconnect(@CurrentTenant() tenantId: string) {
    await this.oauthService.deleteConnection(tenantId);

    return {
      success: true,
      message: 'GitHub disconnected successfully',
    };
  }
}
