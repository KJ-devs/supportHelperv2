import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SAML, SamlConfig, Profile as SamlProfile } from '@node-saml/node-saml';

export interface NormalizedUserProfile {
  nameID: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  groups?: string[];
}

@Injectable()
export class SamlStrategy {
  private readonly logger = new Logger(SamlStrategy.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Create a SAML client instance for a tenant
   */
  createSamlClient(config: {
    entityId: string;
    ssoUrl: string;
    certificate: string;
    tenantSlug: string;
  }): SAML {
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';
    const callbackUrl = `${apiUrl}/api/auth/sso/saml/callback`;

    const samlConfig: SamlConfig = {
      entryPoint: config.ssoUrl,
      issuer: config.entityId,
      callbackUrl,
      idpCert: config.certificate,
      // Accept POST requests at the callback URL
      acceptedClockSkewMs: 300000, // 5 minutes
      // Validate signature and assertions
      wantAssertionsSigned: true,
      // Additional IdP configuration
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    };

    return new SAML(samlConfig);
  }

  /**
   * Get the redirect URL to initiate SAML login
   */
  async getLoginUrl(samlClient: SAML, relayState?: string): Promise<string> {
    return samlClient.getAuthorizeUrlAsync(relayState || '', undefined, {});
  }

  /**
   * Validate SAML response from IdP
   */
  async validateResponse(samlClient: SAML, body: Record<string, string>): Promise<NormalizedUserProfile> {
    try {
      const { profile } = await samlClient.validatePostResponseAsync(body);

      if (!profile) {
        throw new UnauthorizedException('Invalid SAML response: no profile data');
      }

      return this.normalizeProfile(profile);
    } catch (error) {
      this.logger.error(`SAML validation failed: ${error.message}`, error.stack);
      throw new UnauthorizedException(`SAML validation failed: ${error.message}`);
    }
  }

  /**
   * Normalize SAML profile to common format
   */
  private normalizeProfile(profile: SamlProfile): NormalizedUserProfile {
    const email = this.extractAttribute(profile, 'email') ||
                  this.extractAttribute(profile, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') ||
                  profile.nameID;

    if (!email) {
      throw new UnauthorizedException('SAML response missing email address');
    }

    const groups = this.extractAttribute(profile, 'groups') ||
                   this.extractAttribute(profile, 'http://schemas.xmlsoap.org/claims/Group') ||
                   [];

    return {
      nameID: profile.nameID,
      email: email as string,
      firstName: this.extractAttribute(profile, 'firstName') as string,
      lastName: this.extractAttribute(profile, 'lastName') as string,
      displayName: this.extractAttribute(profile, 'displayName') as string,
      groups: Array.isArray(groups) ? groups : [groups].filter(Boolean),
    };
  }

  private extractAttribute(profile: SamlProfile, key: string): string | string[] | undefined {
    if (!profile || typeof profile !== 'object') {
      return undefined;
    }

    // Try direct key access
    if (key in profile) {
      return profile[key as keyof SamlProfile] as string | string[];
    }

    // Try case-insensitive match
    const lowerKey = key.toLowerCase();
    const matchingKey = Object.keys(profile).find(k => k.toLowerCase() === lowerKey);

    if (matchingKey) {
      return profile[matchingKey as keyof SamlProfile] as string | string[];
    }

    return undefined;
  }
}
