import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubAppService } from './github-app.service';

@Injectable()
export class ProjectGithubConfigService {
  private readonly logger = new Logger(ProjectGithubConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appService: GithubAppService,
  ) {}

  /**
   * Connect a GitHub repository to an application (project).
   * Creates a ProjectGithubConfig record.
   */
  async connectRepo(
    applicationId: string,
    tenantId: string,
    installationId: number,
    owner: string,
    repo: string,
    defaultBranch: string = 'main',
  ) {
    // Verify application belongs to tenant
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify installation belongs to tenant
    const installation = await this.prisma.githubInstallation.findFirst({
      where: {
        installationId: BigInt(installationId),
        tenantId,
      },
    });

    if (!installation) {
      throw new NotFoundException(
        'GitHub installation not found for this tenant',
      );
    }

    // Verify the installation has access to the requested repo
    try {
      const octokit = await this.appService.getInstallationOctokit(installationId);
      await octokit.repos.get({ owner, repo });
    } catch (error) {
      // Re-throw NestJS HTTP exceptions as-is (e.g. token acquisition failures)
      if (error instanceof HttpException) {
        throw error;
      }
      // Otherwise it's a GitHub API error (likely 404 = no repo access)
      throw new BadRequestException(
        `The GitHub App installation does not have access to ${owner}/${repo}. ` +
        'Please ensure the repository is included in the installation permissions.',
      );
    }

    // Check if application already has a config
    const existing = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
    });

    if (existing) {
      throw new ConflictException(
        'This application already has a GitHub repository connected. Disconnect first.',
      );
    }

    const config = await this.prisma.projectGithubConfig.create({
      data: {
        applicationId,
        installationId: BigInt(installationId),
        owner,
        repo,
        defaultBranch,
      },
    });

    this.logger.log(
      `Connected ${owner}/${repo} to application ${applicationId}`,
    );

    return this.serializeConfig(config);
  }

  /**
   * Disconnect a GitHub repository from an application.
   */
  async disconnectRepo(applicationId: string, tenantId: string) {
    // Verify application belongs to tenant
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
    });

    if (!config) {
      throw new NotFoundException('No GitHub config found for this application');
    }

    await this.prisma.projectGithubConfig.delete({
      where: { id: config.id },
    });

    this.logger.log(
      `Disconnected GitHub from application ${applicationId}`,
    );

    return { success: true };
  }

  /**
   * Get the GitHub config for an application.
   */
  async getConfig(applicationId: string, tenantId: string) {
    // Verify application belongs to tenant
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
      include: { installation: true },
    });

    if (!config) {
      return null;
    }

    return {
      ...this.serializeConfig(config),
      installation: {
        id: config.installation.id,
        installationId: Number(config.installation.installationId),
        accountLogin: config.installation.accountLogin,
        accountType: config.installation.accountType,
      },
    };
  }

  /**
   * Update settings for a project GitHub config.
   */
  async updateSettings(
    applicationId: string,
    tenantId: string,
    settings: Record<string, any>,
  ) {
    // Verify application belongs to tenant
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const config = await this.prisma.projectGithubConfig.findFirst({
      where: { applicationId },
    });

    if (!config) {
      throw new NotFoundException('No GitHub config found for this application');
    }

    // Merge new settings with existing
    const existingSettings = (config.settings as Record<string, unknown>) ?? {};
    const mergedSettings = { ...existingSettings, ...settings };

    const updated = await this.prisma.projectGithubConfig.update({
      where: { id: config.id },
      data: { settings: mergedSettings },
    });

    return this.serializeConfig(updated);
  }

  /**
   * Serialize config for JSON response (BigInt -> number).
   */
  private serializeConfig(config: any) {
    return {
      id: config.id,
      applicationId: config.applicationId,
      installationId: Number(config.installationId),
      owner: config.owner,
      repo: config.repo,
      fullName: `${config.owner}/${config.repo}`,
      defaultBranch: config.defaultBranch,
      settings: config.settings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
