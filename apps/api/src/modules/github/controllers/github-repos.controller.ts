import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { GithubReposService } from '../services/github-repos.service';
import { ListReposQueryDto, LinkRepoDto } from '../dto';

@ApiTags('GitHub Repositories')
@ApiBearerAuth()
@Controller('github/repos')
@UseGuards(JwtAuthGuard)
export class GithubReposController {
  constructor(private readonly reposService: GithubReposService) {}

  /**
   * POST /github/repos
   * List authenticated user's repositories
   */
  @Post()
  @ApiOperation({ summary: 'List user repositories from GitHub' })
  async listRepositories(@CurrentTenant() tenantId: string, @Query() query: ListReposQueryDto) {
    return this.reposService.listRepositories(tenantId, query);
  }

  /**
   * GET /github/repos
   * List repositories (alternative to POST)
   */
  @Get()
  @ApiOperation({ summary: 'List user repositories from GitHub' })
  async listRepositoriesGet(@CurrentTenant() tenantId: string, @Query() query: ListReposQueryDto) {
    return this.reposService.listRepositories(tenantId, query);
  }

  /**
   * GET /github/repos/connected
   * List connected repositories for tenant
   */
  @Get('connected')
  @ApiOperation({ summary: 'List connected repositories' })
  async connectedRepositories(@CurrentTenant() tenantId: string) {
    const repos = await this.reposService.getConnectedRepositories(tenantId);
    return { repositories: repos };
  }

  /**
   * GET /github/repos/:repository
   * Get a specific repository details
   */
  @Get(':owner/:repo')
  @ApiOperation({ summary: 'Get repository details' })
  async getRepository(
    @CurrentTenant() tenantId: string,
    @Param('owner') owner: string,
    @Param('repo') repo: string
  ) {
    return this.reposService.getRepository(tenantId, `${owner}/${repo}`);
  }

  /**
   * POST /github/repos/link
   * Link a repository to an application
   */
  @Post('link')
  @ApiOperation({ summary: 'Link repository to application' })
  async linkRepository(@CurrentTenant() tenantId: string, @Body() dto: LinkRepoDto) {
    return this.reposService.linkRepository(tenantId, dto.applicationId, dto.repository);
  }

  /**
   * DELETE /github/repos/link/:applicationId
   * Unlink repository from application
   */
  @Delete('link/:applicationId')
  @ApiOperation({ summary: 'Unlink repository from application' })
  async unlinkRepository(
    @CurrentTenant() tenantId: string,
    @Param('applicationId') applicationId: string
  ) {
    return this.reposService.unlinkRepository(tenantId, applicationId);
  }
}
