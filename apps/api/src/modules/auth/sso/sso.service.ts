import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SsoCryptoService } from './sso-crypto.service';
import { SamlStrategy, NormalizedUserProfile } from './strategies/saml.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { UpdateSsoConfigDto } from './dto';
import { AuthService } from '../../../auth/auth.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: SsoCryptoService,
    private readonly samlStrategy: SamlStrategy,
    private readonly oidcStrategy: OidcStrategy,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get SSO config for tenant (decrypt and mask secrets)
   */
  async getConfig(tenantId: string) {
    const ssoConfig = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });

    if (!ssoConfig) {
      throw new NotFoundException('SSO configuration not found');
    }

    return this.decryptAndMaskConfig(ssoConfig);
  }

  /**
   * Get SSO config by tenant slug (for login flow)
   */
  async getConfigBySlug(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { ssoConfig: true },
    });

    if (!tenant || !tenant.ssoConfig) {
      throw new NotFoundException('SSO configuration not found for tenant');
    }

    if (!tenant.ssoConfig.enabled) {
      throw new BadRequestException('SSO is not enabled for this tenant');
    }

    // Decrypt config from database
    const decryptedConfig = this.cryptoService.decrypt(tenant.ssoConfig.config, tenant.ssoConfig.configIv);

    // Return decrypted config for internal use
    return {
      ...tenant.ssoConfig,
      config: JSON.parse(decryptedConfig),
      tenantSlug: tenant.slug,
    };
  }

  /**
   * Update or create SSO config
   */
  async updateConfig(tenantId: string, dto: UpdateSsoConfigDto) {
    // Validate provider-specific fields
    this.validateProviderConfig(dto);

    // Build encrypted config object
    const configData = this.buildConfigData(dto);
    const encryptedConfig = this.cryptoService.encrypt(JSON.stringify(configData));

    const existingConfig = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });

    const ssoConfig = existingConfig
      ? await this.prisma.ssoConfig.update({
          where: { tenantId },
          data: {
            providerType: dto.providerType,
            enabled: dto.enabled,
            config: encryptedConfig.ciphertext,
            configIv: encryptedConfig.iv,
            roleMapping: dto.roleMapping || {},
            autoProvision: dto.autoProvision ?? true,
            disablePassword: dto.disablePassword ?? false,
          },
        })
      : await this.prisma.ssoConfig.create({
          data: {
            tenantId,
            providerType: dto.providerType,
            enabled: dto.enabled,
            config: encryptedConfig.ciphertext,
            configIv: encryptedConfig.iv,
            roleMapping: dto.roleMapping || {},
            autoProvision: dto.autoProvision ?? true,
            disablePassword: dto.disablePassword ?? false,
          },
        });

    this.logger.log(`Updated ${dto.providerType} SSO config for tenant ${tenantId}`);

    return this.decryptAndMaskConfig(ssoConfig);
  }

  /**
   * Delete SSO config
   */
  async deleteConfig(tenantId: string) {
    const existingConfig = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });

    if (!existingConfig) {
      throw new NotFoundException('SSO configuration not found');
    }

    await this.prisma.ssoConfig.delete({
      where: { tenantId },
    });

    this.logger.log(`Deleted SSO config for tenant ${tenantId}`);
  }

  /**
   * Validate SAML response from IdP
   */
  async validateSamlResponse(tenantSlug: string, samlResponse: Record<string, string>): Promise<NormalizedUserProfile> {
    const ssoConfig = await this.getConfigBySlug(tenantSlug);

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

    return this.samlStrategy.validateResponse(samlClient, samlResponse);
  }

  /**
   * Handle OIDC callback (exchange code for tokens)
   */
  async handleOidcCallback(tenantSlug: string, callbackParams: Record<string, string | string[]>, state: string) {
    const ssoConfig = await this.getConfigBySlug(tenantSlug);

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

    const { profile } = await this.oidcStrategy.handleCallback(oidcConfig, callbackParams, state);

    return profile;
  }

  /**
   * Provision or update user from SSO profile
   */
  async provisionUser(
    tenantId: string,
    profile: NormalizedUserProfile,
    providerType: 'saml' | 'oidc',
  ) {
    const ssoConfig = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });

    if (!ssoConfig) {
      throw new NotFoundException('SSO configuration not found');
    }

    // Find existing user by email
    let user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: profile.email,
      },
    });

    // Map roles from IdP groups
    const role = this.mapRoles(profile.groups || [], ssoConfig.roleMapping as Record<string, string>);

    if (user) {
      // Update existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email,
          role,
          authProvider: providerType,
          authProviderId: profile.nameID,
        },
      });

      this.logger.log(`Updated existing user ${user.email} via ${providerType} SSO`);
    } else {
      // Check if auto-provisioning is enabled
      if (!ssoConfig.autoProvision) {
        throw new UnauthorizedException('User does not exist and auto-provisioning is disabled');
      }

      // Create new user
      user = await this.prisma.user.create({
        data: {
          tenantId,
          email: profile.email,
          name: profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.email,
          role,
          authProvider: providerType,
          authProviderId: profile.nameID,
          // No password hash for SSO users
          passwordHash: null,
        },
      });

      this.logger.log(`Auto-provisioned new user ${user.email} via ${providerType} SSO`);
    }

    return user;
  }

  /**
   * Map IdP groups to app roles based on role mapping
   */
  private mapRoles(idpGroups: string[], roleMapping: Record<string, string>): string {
    // Default to 'member' role
    let role = 'member';

    // Check if any IdP group maps to a role
    for (const group of idpGroups) {
      if (roleMapping[group]) {
        const mappedRole = roleMapping[group];
        // Prioritize higher privilege roles
        if (mappedRole === 'owner' || mappedRole === 'admin') {
          return mappedRole;
        }
        role = mappedRole;
      }
    }

    return role;
  }

  /**
   * Test SSO connection (validation only)
   */
  async testConnection(tenantId: string) {
    const ssoConfig = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });

    if (!ssoConfig) {
      throw new NotFoundException('SSO configuration not found');
    }

    const decryptedConfigStr = this.cryptoService.decrypt(ssoConfig.config, ssoConfig.configIv);
    const config = JSON.parse(decryptedConfigStr);

    try {
      if (ssoConfig.providerType === 'saml') {
        // Validate SAML config
        if (!config.entityId || !config.ssoUrl || !config.certificate) {
          throw new BadRequestException('Missing required SAML configuration');
        }

        // Try creating SAML client
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        this.samlStrategy.createSamlClient({
          entityId: config.entityId,
          ssoUrl: config.ssoUrl,
          certificate: config.certificate,
          tenantSlug: tenant?.slug || 'unknown',
        });

        return { success: true, message: 'SAML configuration is valid' };
      } else if (ssoConfig.providerType === 'oidc') {
        // Validate OIDC config
        if (!config.issuerUrl || !config.clientId || !config.clientSecret) {
          throw new BadRequestException('Missing required OIDC configuration');
        }

        // Try discovering OIDC issuer
        const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        await this.oidcStrategy.getOidcConfig({
          issuerUrl: config.issuerUrl,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          tenantSlug: tenant?.slug || 'unknown',
        });

        return { success: true, message: 'OIDC configuration is valid and issuer is reachable' };
      }

      throw new BadRequestException('Unknown provider type');
    } catch (error) {
      this.logger.error(`SSO connection test failed: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }

  /**
   * Check if password login is disabled for a tenant
   */
  async isPasswordLoginDisabled(tenantId: string): Promise<boolean> {
    const ssoConfig = await this.prisma.ssoConfig.findUnique({
      where: { tenantId },
    });

    return ssoConfig?.enabled && ssoConfig?.disablePassword || false;
  }

  // Helper methods

  private validateProviderConfig(dto: UpdateSsoConfigDto) {
    if (dto.providerType === 'saml') {
      if (!dto.entityId || !dto.ssoUrl || !dto.certificate) {
        throw new BadRequestException('SAML requires entityId, ssoUrl, and certificate');
      }
    } else if (dto.providerType === 'oidc') {
      if (!dto.clientId || !dto.clientSecret || !dto.issuerUrl) {
        throw new BadRequestException('OIDC requires clientId, clientSecret, and issuerUrl');
      }
    }
  }

  private buildConfigData(dto: UpdateSsoConfigDto): Record<string, string> {
    if (dto.providerType === 'saml') {
      return {
        entityId: dto.entityId!,
        ssoUrl: dto.ssoUrl!,
        certificate: dto.certificate!,
      };
    } else {
      return {
        clientId: dto.clientId!,
        clientSecret: dto.clientSecret!,
        issuerUrl: dto.issuerUrl!,
      };
    }
  }

  private decryptAndMaskConfig(ssoConfig: any) {
    // Decrypt config from database
    const decryptedConfigStr = this.cryptoService.decrypt(ssoConfig.config, ssoConfig.configIv);
    const config = JSON.parse(decryptedConfigStr);

    // Mask sensitive fields
    const maskedConfig: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) {
      if (key === 'clientSecret' || key === 'certificate') {
        maskedConfig[key] = '***MASKED***';
      } else {
        maskedConfig[key] = value as string;
      }
    }

    return {
      id: ssoConfig.id,
      tenantId: ssoConfig.tenantId,
      providerType: ssoConfig.providerType,
      enabled: ssoConfig.enabled,
      config: maskedConfig,
      roleMapping: ssoConfig.roleMapping,
      autoProvision: ssoConfig.autoProvision,
      disablePassword: ssoConfig.disablePassword,
      createdAt: ssoConfig.createdAt,
      updatedAt: ssoConfig.updatedAt,
    };
  }
}
