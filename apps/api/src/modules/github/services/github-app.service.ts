import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import * as jwt from 'jsonwebtoken';
import { CacheService } from '../../../cache/cache.service';

export interface GithubAppInfo {
  id: number;
  name: string;
  slug: string;
  installUrl: string;
}

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);
  private readonly appId: string;
  private readonly privateKey: string;
  private readonly appName: string;
  private readonly appEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.appId = this.config.get('github.appId') || '';
    // Normalize line endings: handle both escaped \n and Windows CRLF
    this.privateKey = (this.config.get<string>('github.privateKey') || '').replace(/\r\n/g, '\n');
    this.appName = this.config.get('github.appName') || '';
    this.appEnabled = this.config.get('github.appEnabled') || false;
  }

  /**
   * Check if GitHub App integration is enabled
   */
  isEnabled(): boolean {
    return this.appEnabled;
  }

  /**
   * Generate a JWT for authenticating as the GitHub App (RS256, 10 min expiry).
   * Per GitHub docs: iat is backdated by 60s to account for clock drift.
   */
  generateAppJwt(): string {
    if (!this.appId || !this.privateKey) {
      throw new BadRequestException(
        'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_PRIVATE_KEY.',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const iat = now - 60;

    const payload = {
      iss: this.appId,
      iat,
      exp: iat + 600,
    };

    try {
      return jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    } catch (error) {
      this.logger.error('Failed to sign GitHub App JWT', error);
      throw new InternalServerErrorException(
        'Failed to generate GitHub App JWT. Check that GITHUB_PRIVATE_KEY is a valid PEM key.',
      );
    }
  }

  /**
   * Get an installation access token from GitHub.
   * Cached in Redis for 55 minutes (tokens expire after 60 min).
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const cacheKey = `github:installation-token:${installationId}`;

    const cached = await this.cacheService.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const appJwt = this.generateAppJwt();
    const octokit = new Octokit({ auth: appJwt });

    try {
      const { data } = await octokit.apps.createInstallationAccessToken({
        installation_id: installationId,
      });

      // Cache for 55 minutes (tokens last 60 min)
      await this.cacheService.set(cacheKey, data.token, 55 * 60);

      this.logger.log(
        `Created installation token for installation ${installationId}`,
      );

      return data.token;
    } catch (error) {
      this.logger.error(
        `Failed to get installation token for ${installationId}`,
        error,
      );
      throw new InternalServerErrorException(
        `Failed to get GitHub installation token for installation ${installationId}`,
      );
    }
  }

  /**
   * Invalidate cached installation token (e.g., on uninstall).
   */
  async invalidateInstallationToken(installationId: number): Promise<void> {
    const cacheKey = `github:installation-token:${installationId}`;
    await this.cacheService.del(cacheKey);
  }

  /**
   * Get the GitHub App's public info via the API.
   */
  async getAppInfo(): Promise<GithubAppInfo> {
    try {
      const appJwt = this.generateAppJwt();
      const octokit = new Octokit({ auth: appJwt });
      const response = await octokit.apps.getAuthenticated();
      const data = response.data;

      if (!data) {
        throw new Error('Empty response from GitHub API');
      }

      const slug = data.slug ?? this.appName;

      return {
        id: data.id,
        name: data.name,
        slug,
        installUrl: `https://github.com/apps/${slug}/installations/new`,
      };
    } catch (error) {
      this.logger.warn(
        'Failed to get GitHub App info from API, falling back to local config',
        error,
      );

      // Fall back to local configuration if GitHub API is unreachable or JWT fails
      if (this.appName) {
        return {
          id: parseInt(this.appId, 10) || 0,
          name: this.appName,
          slug: this.appName,
          installUrl: `https://github.com/apps/${this.appName}/installations/new`,
        };
      }

      throw new InternalServerErrorException(
        'Failed to retrieve GitHub App info from GitHub API.',
      );
    }
  }

  /**
   * Create an authenticated Octokit instance scoped to an installation.
   */
  async getInstallationOctokit(installationId: number): Promise<Octokit> {
    const token = await this.getInstallationToken(installationId);
    return new Octokit({ auth: token });
  }
}
