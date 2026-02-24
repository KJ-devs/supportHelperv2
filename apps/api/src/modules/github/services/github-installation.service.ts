import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubAppService } from './github-app.service';

@Injectable()
export class GithubInstallationService {
  private readonly logger = new Logger(GithubInstallationService.name);
  private readonly appName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly appService: GithubAppService,
  ) {
    this.appName = this.config.get('github.appName') || '';
  }

  /**
   * Get the installation URL for the GitHub App.
   * Users visit this URL to install the app on their org/account.
   */
  getInstallUrl(tenantId: string): string {
    // Pass tenantId as state so we can map the installation to the tenant on callback
    return `https://github.com/apps/${this.appName}/installations/new?state=${tenantId}`;
  }

  /**
   * Handle the GitHub App installation callback.
   * Called when user is redirected back after installing the app.
   */
  async handleInstallationCallback(
    installationId: number,
    tenantId: string,
  ) {
    // Verify the installation exists on GitHub using App JWT (not installation token)
    const appJwt = this.appService.generateAppJwt();
    const octokit = new Octokit({ auth: appJwt });

    let accountLogin: string;
    let accountType: string;
    let permissions: Record<string, string>;

    try {
      const { data: installation } = await octokit.apps.getInstallation({
        installation_id: installationId,
      });
      const account = installation.account as Record<string, any> | null;
      accountLogin = account?.login ?? account?.name ?? 'unknown';
      accountType = account?.type ?? 'Organization';
      permissions = (installation.permissions as Record<string, string>) ?? {};
    } catch (error) {
      this.logger.error(
        `Failed to verify installation ${installationId} on GitHub`,
        error,
      );
      throw new BadRequestException(
        `Installation ${installationId} not found on GitHub. It may have been removed.`,
      );
    }

    // Check if installation already exists for this tenant
    const existing = await this.prisma.githubInstallation.findUnique({
      where: { installationId: BigInt(installationId) },
    });

    if (existing) {
      if (existing.tenantId === tenantId) {
        // Same tenant re-installing, update record
        return this.prisma.githubInstallation.update({
          where: { id: existing.id },
          data: {
            accountLogin,
            accountType,
            permissions: permissions,
            suspendedAt: null,
          },
        });
      }

      // Installation belongs to a different tenant
      throw new ConflictException(
        'This GitHub App installation is already linked to another tenant.',
      );
    }

    // Create new installation record
    const record = await this.prisma.githubInstallation.create({
      data: {
        tenantId,
        installationId: BigInt(installationId),
        accountLogin,
        accountType,
        permissions: permissions,
      },
    });

    this.logger.log(
      `Saved installation ${installationId} (${accountLogin}) for tenant ${tenantId}`,
    );

    return record;
  }

  /**
   * List all installations for a tenant.
   */
  async getInstallations(tenantId: string) {
    return this.prisma.githubInstallation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single installation by ID, scoped to tenant.
   */
  async getInstallation(installationId: string, tenantId: string) {
    const installation = await this.prisma.githubInstallation.findFirst({
      where: { id: installationId, tenantId },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    return installation;
  }

  /**
   * Remove an installation record (soft: just deletes our DB record).
   * The actual GitHub App installation remains on the user's account.
   */
  async removeInstallation(installationId: string, tenantId: string) {
    const installation = await this.prisma.githubInstallation.findFirst({
      where: { id: installationId, tenantId },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    // Invalidate cached token
    await this.appService.invalidateInstallationToken(
      Number(installation.installationId),
    );

    await this.prisma.githubInstallation.delete({
      where: { id: installation.id },
    });

    this.logger.log(
      `Removed installation ${installation.installationId} for tenant ${tenantId}`,
    );

    return { success: true };
  }
}
