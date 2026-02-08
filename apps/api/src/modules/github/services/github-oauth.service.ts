import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';

export interface OAuthStatePayload {
  tenantId: string;
  redirectUri?: string;
  timestamp: number;
  nonce: string;
}

export interface GithubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

export interface GithubUser {
  id: number;
  login: string;
  email?: string;
  name?: string;
}

@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly enabled: boolean;
  private readonly apiUrl: string;
  private readonly stateSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService
  ) {
    this.clientId = this.config.get('github.clientId') || '';
    this.clientSecret = this.config.get('github.clientSecret') || '';
    this.enabled = this.config.get('github.enabled') || false;
    this.apiUrl = this.config.get('app.apiUrl') || 'http://localhost:3000';
    // Use webhook secret as state encryption key or generate one
    this.stateSecret = this.config.get('github.webhookSecret') || 'github-state-secret';
  }

  /**
   * Check if GitHub integration is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Generate a CSRF state token for OAuth flow
   */
  generateStateToken(tenantId: string, redirectUri?: string): string {
    const payload: OAuthStatePayload = {
      tenantId,
      redirectUri,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const data = JSON.stringify(payload);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(this.stateSecret).digest(),
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Combine IV and encrypted data
    const combined = Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
    return combined.toString('base64url');
  }

  /**
   * Verify and decode state token
   */
  verifyStateToken(state: string): OAuthStatePayload {
    try {
      const combined = Buffer.from(state, 'base64url');
      const iv = combined.subarray(0, 16);
      const encrypted = combined.subarray(16).toString('base64');

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        crypto.createHash('sha256').update(this.stateSecret).digest(),
        iv
      );

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      const payload: OAuthStatePayload = JSON.parse(decrypted);

      // Check token age (10 minutes max)
      const maxAge = 10 * 60 * 1000;
      if (Date.now() - payload.timestamp > maxAge) {
        throw new BadRequestException('OAuth state token expired');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid OAuth state token');
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(tenantId: string, redirectUri?: string): { url: string; state: string } {
    if (!this.enabled) {
      throw new BadRequestException('GitHub integration is not enabled');
    }

    const state = this.generateStateToken(tenantId, redirectUri);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: `${this.apiUrl}/api/github/oauth/callback`,
      scope: 'repo,read:user,user:email,admin:repo_hook',
      state,
      allow_signup: 'false',
    });

    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<GithubTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    const data = await response.json();

    if (data.error) {
      this.logger.error(`GitHub OAuth error: ${data.error_description}`);
      throw new UnauthorizedException(`GitHub OAuth failed: ${data.error_description}`);
    }

    return data as GithubTokenResponse;
  }

  /**
   * Get authenticated user info from GitHub
   */
  async getAuthenticatedUser(accessToken: string): Promise<GithubUser> {
    const octokit = new Octokit({ auth: accessToken });

    const { data: user } = await octokit.users.getAuthenticated();

    // Try to get primary email
    let email: string | undefined;
    try {
      const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser();
      const primary = emails.find(e => e.primary);
      email = primary?.email;
    } catch {
      // Email scope might not be granted
    }

    return {
      id: user.id,
      login: user.login,
      email: email || user.email || undefined,
      name: user.name || undefined,
    };
  }

  /**
   * Save GitHub connection for tenant
   */
  async saveConnection(
    tenantId: string,
    accessToken: string,
    installationId: bigint = BigInt(0),
    refreshToken?: string,
    expiresIn?: number
  ) {
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    // Check if connection already exists
    const existing = await this.prisma.githubConnection.findFirst({
      where: { tenantId },
    });

    if (existing) {
      // Update existing connection
      return this.prisma.githubConnection.update({
        where: { id: existing.id },
        data: {
          accessToken,
          refreshToken,
          tokenExpiresAt,
        },
      });
    }

    // Create new connection
    return this.prisma.githubConnection.create({
      data: {
        tenantId,
        installationId,
        accessToken,
        refreshToken,
        tokenExpiresAt,
        repos: [],
      },
    });
  }

  /**
   * Get GitHub connection for tenant
   */
  async getConnection(tenantId: string) {
    return this.prisma.githubConnection.findFirst({
      where: { tenantId },
    });
  }

  /**
   * Delete GitHub connection
   */
  async deleteConnection(tenantId: string) {
    const connection = await this.getConnection(tenantId);
    if (connection) {
      await this.prisma.githubConnection.delete({
        where: { id: connection.id },
      });
    }
  }

  /**
   * Get Octokit instance for tenant
   */
  async getOctokitForTenant(tenantId: string): Promise<Octokit> {
    const connection = await this.getConnection(tenantId);

    if (!connection || !connection.accessToken) {
      throw new UnauthorizedException('GitHub not connected for this tenant');
    }

    // Check if token is expired and needs refresh
    if (
      connection.tokenExpiresAt &&
      connection.tokenExpiresAt < new Date() &&
      connection.refreshToken
    ) {
      // Token refresh would be implemented here
      // For now, throw error to re-authenticate
      throw new UnauthorizedException('GitHub token expired, please reconnect');
    }

    return new Octokit({ auth: connection.accessToken });
  }

  /**
   * Setup webhooks for a repository
   */
  async setupWebhook(
    tenantId: string,
    repository: string,
    events: string[] = ['issues', 'pull_request', 'push']
  ) {
    const octokit = await this.getOctokitForTenant(tenantId);
    const [owner, repo] = repository.split('/');
    const webhookUrl = `${this.apiUrl}/api/github/webhooks`;
    const webhookSecret = this.config.get('github.webhookSecret');

    try {
      // Check if webhook already exists
      const { data: hooks } = await octokit.repos.listWebhooks({
        owner,
        repo,
      });

      const existingHook = hooks.find(h => h.config.url === webhookUrl);
      if (existingHook) {
        this.logger.log(`Webhook already exists for ${repository}`);
        return existingHook;
      }

      // Create new webhook
      const { data: hook } = await octokit.repos.createWebhook({
        owner,
        repo,
        name: 'web',
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
          insecure_ssl: '0',
        },
        events,
        active: true,
      });

      this.logger.log(`Created webhook for ${repository}: ${hook.id}`);
      return hook;
    } catch (error) {
      this.logger.error(`Failed to setup webhook for ${repository}:`, error);
      throw error;
    }
  }
}
