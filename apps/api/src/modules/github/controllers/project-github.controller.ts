import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { GithubReposService } from '../services/github-repos.service';
import { ProjectGithubConfigService } from '../services/project-github-config.service';
import { ConnectRepoDto, UpdateProjectGithubSettingsDto } from '../dto/project-github-config.dto';

@ApiTags('GitHub Project Config')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectGithubController {
  constructor(
    private readonly reposService: GithubReposService,
    private readonly configService: ProjectGithubConfigService,
  ) {}

  /**
   * GET /github/installations/:installationId/repos
   * List repos accessible by a GitHub App installation.
   */
  @Get('github/installations/:installationId/repos')
  @ApiOperation({ summary: 'List repos accessible by a GitHub App installation' })
  @ApiParam({ name: 'installationId', description: 'GitHub installation ID (numeric)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  async listInstallationRepos(
    @Param('installationId') installationIdStr: string,
    @Query('page') pageStr?: string,
    @Query('perPage') perPageStr?: string,
  ) {
    const installationId = parseInt(installationIdStr, 10);
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const perPage = perPageStr ? parseInt(perPageStr, 10) : 30;

    return this.reposService.listInstallationRepos(installationId, page, perPage);
  }

  /**
   * POST /applications/:id/github/connect
   * Link a GitHub repository to an application via GitHub App installation.
   */
  @Post('applications/:id/github/connect')
  @ApiOperation({ summary: 'Connect a GitHub repo to an application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async connectRepo(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: ConnectRepoDto,
  ) {
    return this.configService.connectRepo(
      applicationId,
      tenantId,
      dto.installationId,
      dto.owner,
      dto.repo,
      dto.defaultBranch,
    );
  }

  /**
   * DELETE /applications/:id/github/disconnect
   * Unlink a GitHub repository from an application.
   */
  @Delete('applications/:id/github/disconnect')
  @ApiOperation({ summary: 'Disconnect GitHub repo from an application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async disconnectRepo(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.configService.disconnectRepo(applicationId, tenantId);
  }

  /**
   * GET /applications/:id/github/config
   * Get the current GitHub config for an application.
   */
  @Get('applications/:id/github/config')
  @ApiOperation({ summary: 'Get GitHub config for an application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async getConfig(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const config = await this.configService.getConfig(applicationId, tenantId);

    if (!config) {
      return { connected: false };
    }

    return { connected: true, config };
  }

  /**
   * PATCH /applications/:id/github/settings
   * Update GitHub settings for an application.
   */
  @Patch('applications/:id/github/settings')
  @ApiOperation({ summary: 'Update GitHub settings for an application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async updateSettings(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateProjectGithubSettingsDto,
  ) {
    return this.configService.updateSettings(applicationId, tenantId, dto);
  }
}
