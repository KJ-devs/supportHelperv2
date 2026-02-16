import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../../auth/decorators/public.decorator';
import { SsoService } from './sso.service';
import { SamlStrategy } from './strategies/saml.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@ApiTags('SSO Authentication')
@Controller('auth/sso')
@Public()
export class SsoAuthController {
  constructor(
    private readonly ssoService: SsoService,
    private readonly samlStrategy: SamlStrategy,
    private readonly oidcStrategy: OidcStrategy,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get('saml/login')
  @ApiOperation({ summary: 'Initiate SAML login' })
  @ApiQuery({ name: 'tenant', description: 'Tenant slug' })
  @ApiResponse({ status: 302, description: 'Redirect to SAML IdP' })
  async samlLogin(@Query('tenant') tenantSlug: string, @Res() res: Response) {
    if (!tenantSlug) {
      throw new BadRequestException('Tenant slug is required');
    }

    const ssoConfig = await this.ssoService.getConfigBySlug(tenantSlug);

    if (ssoConfig.providerType !== 'saml') {
      throw new BadRequestException('Tenant is not configured for SAML SSO');
    }

    const config = ssoConfig.config as Record<string, string>;

    const samlClient = this.samlStrategy.createSamlClient({
      entityId: config.entityId,
      ssoUrl: config.ssoUrl,
      certificate: config.certificate,
      tenantSlug,
    });

    // Use tenant slug as relay state
    const loginUrl = await this.samlStrategy.getLoginUrl(samlClient, tenantSlug);

    return res.redirect(loginUrl);
  }

  @Post('saml/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SAML Assertion Consumer Service (ACS)' })
  @ApiResponse({ status: 200, description: 'SAML authentication successful' })
  async samlCallback(@Body() body: Record<string, string>, @Res() res: Response) {
    const relayState = body.RelayState;

    if (!relayState) {
      throw new BadRequestException('Missing RelayState parameter');
    }

    const tenantSlug = relayState;

    // Validate SAML response
    const profile = await this.ssoService.validateSamlResponse(tenantSlug, body);

    // Get tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    // Provision or update user
    const user = await this.ssoService.provisionUser(tenant.id, profile, 'saml');

    // Generate JWT tokens (same as normal login)
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      type: 'refresh',
    };

    const refreshTokenSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshTokenSecret,
      expiresIn: '30d',
    });

    // Redirect to dashboard with tokens
    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL') || 'http://localhost:3000';
    const redirectUrl = `${dashboardUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`;

    return res.redirect(redirectUrl);
  }

  @Get('oidc/login')
  @ApiOperation({ summary: 'Initiate OIDC login' })
  @ApiQuery({ name: 'tenant', description: 'Tenant slug' })
  @ApiResponse({ status: 302, description: 'Redirect to OIDC provider' })
  async oidcLogin(@Query('tenant') tenantSlug: string, @Res() res: Response) {
    if (!tenantSlug) {
      throw new BadRequestException('Tenant slug is required');
    }

    const ssoConfig = await this.ssoService.getConfigBySlug(tenantSlug);

    if (ssoConfig.providerType !== 'oidc') {
      throw new BadRequestException('Tenant is not configured for OIDC SSO');
    }

    const config = ssoConfig.config as Record<string, string>;

    const oidcConfig = await this.oidcStrategy.getOidcConfig({
      issuerUrl: config.issuerUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tenantSlug,
    });

    // Generate state with tenant slug
    const state = `${tenantSlug}:${crypto.randomBytes(16).toString('hex')}`;

    const authUrl = await this.oidcStrategy.getAuthorizationUrl(oidcConfig, state);

    return res.redirect(authUrl);
  }

  @Get('oidc/callback')
  @ApiOperation({ summary: 'OIDC callback' })
  @ApiResponse({ status: 302, description: 'Redirect to dashboard with tokens' })
  async oidcCallback(@Query() query: Record<string, string | string[]>, @Res() res: Response) {
    const state = query.state as string;

    if (!state) {
      throw new BadRequestException('Missing state parameter');
    }

    // Extract tenant slug from state
    const [tenantSlug] = state.split(':');

    if (!tenantSlug) {
      throw new BadRequestException('Invalid state parameter');
    }

    // Handle callback
    const profile = await this.ssoService.handleOidcCallback(tenantSlug, query, state);

    // Get tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found');
    }

    // Provision or update user
    const user = await this.ssoService.provisionUser(tenant.id, profile, 'oidc');

    // Generate JWT tokens (same as normal login)
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      type: 'refresh',
    };

    const refreshTokenSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshTokenSecret,
      expiresIn: '30d',
    });

    // Redirect to dashboard with tokens
    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL') || 'http://localhost:3000';
    const redirectUrl = `${dashboardUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`;

    return res.redirect(redirectUrl);
  }
}
