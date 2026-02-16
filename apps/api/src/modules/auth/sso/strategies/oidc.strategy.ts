import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'openid-client';
import { NormalizedUserProfile } from './saml.strategy';
import * as crypto from 'crypto';

interface OidcState {
  codeVerifier: string;
  nonce: string;
}

@Injectable()
export class OidcStrategy {
  private readonly logger = new Logger(OidcStrategy.name);
  private readonly configCache = new Map<string, client.Configuration>();
  private readonly stateStore = new Map<string, OidcState>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get or create OIDC configuration for a tenant
   */
  async getOidcConfig(config: {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    tenantSlug: string;
  }): Promise<client.Configuration> {
    const cacheKey = `${config.tenantSlug}-${config.issuerUrl}`;

    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    try {
      // Discover OIDC configuration from issuer
      const issuerUrl = new URL(config.issuerUrl);

      const configuration = await client.discovery(
        issuerUrl,
        config.clientId,
        undefined,
        client.ClientSecretPost(config.clientSecret),
      );

      this.configCache.set(cacheKey, configuration);

      this.logger.log(`OIDC configuration initialized for ${config.tenantSlug}`);

      return configuration;
    } catch (error) {
      this.logger.error(`Failed to discover OIDC issuer: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to initialize OIDC client: ${error.message}`);
    }
  }

  /**
   * Generate authorization URL for OIDC login
   */
  async getAuthorizationUrl(configuration: client.Configuration, state: string): Promise<string> {
    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';
    const redirectUri = `${apiUrl}/api/auth/sso/oidc/callback`;

    // Generate PKCE parameters
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const nonce = client.randomNonce();

    // Store state for callback
    this.stateStore.set(state, { codeVerifier, nonce });

    // Auto-cleanup after 10 minutes
    setTimeout(() => this.stateStore.delete(state), 10 * 60 * 1000);

    // Create authorization URL
    const authorizationUrl = client.buildAuthorizationUrl(configuration, {
      redirect_uri: redirectUri,
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    return authorizationUrl.href;
  }

  /**
   * Exchange authorization code for tokens and extract user profile
   */
  async handleCallback(
    configuration: client.Configuration,
    callbackParams: Record<string, string | string[]>,
    state: string,
  ): Promise<{ profile: NormalizedUserProfile }> {
    try {
      const storedState = this.stateStore.get(state);

      if (!storedState) {
        throw new UnauthorizedException('Invalid state: session not found or expired');
      }

      const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';
      const redirectUri = `${apiUrl}/api/auth/sso/oidc/callback`;

      // Create URL from callback params
      const currentUrl = new URL(redirectUri);
      for (const [key, value] of Object.entries(callbackParams)) {
        if (Array.isArray(value)) {
          value.forEach(v => currentUrl.searchParams.append(key, v));
        } else {
          currentUrl.searchParams.set(key, value);
        }
      }

      // Validate authorization response
      const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
        pkceCodeVerifier: storedState.codeVerifier,
        expectedNonce: storedState.nonce,
        idTokenExpected: true,
      });

      // Extract claims from ID token
      const claims = tokens.claims();

      if (!claims) {
        throw new UnauthorizedException('No ID token claims received');
      }

      const profile = this.normalizeProfile(claims);

      // Clean up state
      this.stateStore.delete(state);

      return { profile };
    } catch (error) {
      this.logger.error(`OIDC callback failed: ${error.message}`, error.stack);
      throw new UnauthorizedException(`OIDC authentication failed: ${error.message}`);
    }
  }

  /**
   * Normalize OIDC claims to common format
   */
  private normalizeProfile(claims: client.IDToken): NormalizedUserProfile {
    const email = claims.email as string;
    const sub = claims.sub;

    if (!email) {
      throw new UnauthorizedException('OIDC response missing email address');
    }

    const groups = claims.groups || claims.roles || [];

    return {
      nameID: sub,
      email,
      firstName: claims.given_name as string,
      lastName: claims.family_name as string,
      displayName: claims.name as string,
      groups: Array.isArray(groups) ? groups as string[] : [groups as string].filter(Boolean),
    };
  }
}
