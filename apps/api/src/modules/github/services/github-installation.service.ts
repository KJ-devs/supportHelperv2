import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
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
   * Sync GitHub App installations from GitHub API into the database.
   * Useful when a DB record is missing but the installation exists on GitHub
   * (e.g. after switching machines or resetting the database).
   */
  async syncInstallationsFromGithub(tenantId: string): Promise<{
    synced: number;
    skipped: number;
    installations: any[];
  }> {
    const appJwt = this.appService.generateAppJwt();
    const octokit = new Octokit({ auth: appJwt });

    let githubInstallations: any[];
    try {
      const { data } = await octokit.apps.listInstallations({ per_page: 100 });
      githubInstallations = data;
    } catch (error) {
      this.logger.error('Failed to list installations from GitHub API', error);
      throw new InternalServerErrorException(
        'Failed to fetch installations from GitHub. Check that GITHUB_APP_ID and GITHUB_PRIVATE_KEY are correct.',
      );
    }

    let synced = 0;
    let skipped = 0;
    const syncedInstallations: any[] = [];

    for (const inst of githubInstallations) {
      const existing = await this.prisma.githubInstallation.findUnique({
        where: { installationId: BigInt(inst.id) },
      });

      if (existing) {
        // Already in DB — skip regardless of which tenant owns it
        skipped++;
        continue;
      }

      const account = inst.account as Record<string, any> | null;
      const accountLogin = account?.login ?? account?.name ?? 'unknown';
      const accountType = account?.type ?? 'Organization';
      const permissions = (inst.permissions as Record<string, string>) ?? {};
      const suspendedAt = inst.suspended_at ? new Date(inst.suspended_at) : null;

      const record = await this.prisma.githubInstallation.create({
        data: {
          tenantId,
          installationId: BigInt(inst.id),
          accountLogin,
          accountType,
          permissions,
          ...(suspendedAt ? { suspendedAt } : {}),
        },
      });

      this.logger.log(
        `Synced installation ${inst.id} (${accountLogin}) for tenant ${tenantId}`,
      );

      synced++;
      syncedInstallations.push({
        id: record.id,
        installationId: Number(record.installationId),
        accountLogin: record.accountLogin,
        accountType: record.accountType,
        suspended: !!record.suspendedAt,
        createdAt: record.createdAt,
      });
    }

    this.logger.log(
      `Sync complete for tenant ${tenantId}: ${synced} synced, ${skipped} skipped`,
    );

    return { synced, skipped, installations: syncedInstallations };
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

    // Invalidate cached token (best-effort, don't fail if Redis is down)
    try {
      await this.appService.invalidateInstallationToken(
        Number(installation.installationId),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate token cache for installation ${installation.installationId}`,
        err,
      );
    }

    // Delete related ProjectGithubConfig records first (no onDelete cascade in schema)
    const deleted = await this.prisma.projectGithubConfig.deleteMany({
      where: { installationId: installation.installationId },
    });

    if (deleted.count > 0) {
      this.logger.log(
        `Removed ${deleted.count} repo config(s) linked to installation ${installation.installationId}`,
      );
    }

    await this.prisma.githubInstallation.delete({
      where: { id: installation.id },
    });

    this.logger.log(
      `Removed installation ${installation.installationId} for tenant ${tenantId}`,
    );

    return { success: true };
  }
}
