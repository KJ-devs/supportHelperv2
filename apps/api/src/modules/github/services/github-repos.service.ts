import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { GithubOAuthService } from './github-oauth.service';
import { ListReposQueryDto, GithubRepoDto, ListReposResponseDto } from '../dto';

@Injectable()
export class GithubReposService {
  private readonly logger = new Logger(GithubReposService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private oauthService: GithubOAuthService
  ) {}

  /**
   * List repositories for authenticated user
   */
  async listRepositories(
    tenantId: string,
    query: ListReposQueryDto
  ): Promise<ListReposResponseDto> {
    const octokit = await this.oauthService.getOctokitForTenant(tenantId);

    const { page = 1, perPage = 30, sort = 'updated', visibility = 'all' } = query;

    const params: any = {
      per_page: perPage,
      page,
      sort,
    };

    if (visibility !== 'all') {
      params.visibility = visibility;
    }

    const { data, headers } = await octokit.repos.listForAuthenticatedUser(params);

    // Parse Link header to check if there are more pages
    const linkHeader = headers.link || '';
    const hasMore = linkHeader.includes('rel="next"');

    const repositories: GithubRepoDto[] = data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
      description: repo.description || undefined,
      defaultBranch: repo.default_branch,
      starCount: repo.stargazers_count,
      openIssuesCount: repo.open_issues_count,
      updatedAt: repo.updated_at || repo.created_at || new Date().toISOString(),
    }));

    return {
      repositories,
      total: data.length,
      page,
      hasMore,
    };
  }

  /**
   * Get a specific repository
   */
  async getRepository(tenantId: string, repository: string): Promise<GithubRepoDto> {
    const octokit = await this.oauthService.getOctokitForTenant(tenantId);
    const [owner, repo] = repository.split('/');

    if (!owner || !repo) {
      throw new BadRequestException('Invalid repository format. Use owner/repo');
    }

    const { data } = await octokit.repos.get({ owner, repo });

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      private: data.private,
      url: data.html_url,
      description: data.description || undefined,
      defaultBranch: data.default_branch,
      starCount: data.stargazers_count,
      openIssuesCount: data.open_issues_count,
      updatedAt: data.updated_at || data.created_at || new Date().toISOString(),
    };
  }

  /**
   * Link a repository to an application
   */
  async linkRepository(tenantId: string, applicationId: string, repository: string) {
    // Verify repository exists and is accessible
    await this.getRepository(tenantId, repository);

    // Update application with GitHub repo
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { githubRepo: repository },
    });

    // Setup webhook for the repository
    try {
      await this.oauthService.setupWebhook(tenantId, repository);
    } catch (error) {
      this.logger.warn(`Could not setup webhook for ${repository}:`, error);
      // Don't fail the linking if webhook setup fails
    }

    // Update connection repos list
    const connection = await this.oauthService.getConnection(tenantId);
    if (connection) {
      const currentRepos = (connection.repos as string[]) || [];
      if (!currentRepos.includes(repository)) {
        await this.prisma.githubConnection.update({
          where: { id: connection.id },
          data: {
            repos: [...currentRepos, repository],
          },
        });
      }
    }

    this.logger.log(`Linked repository ${repository} to application ${applicationId}`);

    return updated;
  }

  /**
   * Unlink repository from application
   */
  async unlinkRepository(tenantId: string, applicationId: string) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    return this.prisma.application.update({
      where: { id: applicationId },
      data: { githubRepo: null },
    });
  }

  /**
   * Get connected repositories for tenant
   */
  async getConnectedRepositories(tenantId: string): Promise<string[]> {
    const connection = await this.oauthService.getConnection(tenantId);
    if (!connection) {
      return [];
    }
    return (connection.repos as string[]) || [];
  }
}
