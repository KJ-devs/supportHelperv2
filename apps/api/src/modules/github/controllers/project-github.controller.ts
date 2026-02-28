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
import { TemplateRendererService } from '../services/template-renderer.service';
import { ConnectRepoDto, UpdateProjectGithubSettingsDto } from '../dto/project-github-config.dto';
import { UpdateIssueTemplateDto, PreviewIssueTemplateDto } from '../dto/github-template.dto';

@ApiTags('GitHub Project Config')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ProjectGithubController {
  constructor(
    private readonly reposService: GithubReposService,
    private readonly configService: ProjectGithubConfigService,
    private readonly templateRenderer: TemplateRendererService,
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

  // ── Issue Template Endpoints ──────────────────────────────────────

  /**
   * GET /applications/:id/github/template
   * Get the current issue template (or the default).
   */
  @Get('applications/:id/github/template')
  @ApiOperation({ summary: 'Get issue template for an application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async getTemplate(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const config = await this.configService.getConfig(applicationId, tenantId);
    const settings = (config?.settings as Record<string, unknown>) ?? {};
    const customTemplate = settings.issueBodyTemplate as string | undefined;
    const isDefault = !customTemplate;
    const template = customTemplate || this.templateRenderer.getDefaultTemplate();

    return {
      template,
      isDefault,
      placeholders: this.templateRenderer.getPlaceholders(),
    };
  }

  /**
   * PATCH /applications/:id/github/template
   * Update the issue template for an application.
   */
  @Patch('applications/:id/github/template')
  @ApiOperation({ summary: 'Update issue template for an application' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async updateTemplate(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateIssueTemplateDto,
  ) {
    const validation = this.templateRenderer.validate(dto.template);

    await this.configService.updateSettings(applicationId, tenantId, {
      issueBodyTemplate: dto.template,
    });

    return {
      template: dto.template,
      isDefault: false,
      validation,
    };
  }

  /**
   * POST /applications/:id/github/template/preview
   * Preview a rendered template with sample data.
   */
  @Post('applications/:id/github/template/preview')
  @ApiOperation({ summary: 'Preview rendered issue template' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async previewTemplate(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: PreviewIssueTemplateDto,
  ) {
    let template: string;

    if (dto.template) {
      template = dto.template;
    } else {
      const config = await this.configService.getConfig(applicationId, tenantId);
      const settings = (config?.settings as Record<string, unknown>) ?? {};
      template =
        (settings.issueBodyTemplate as string) ||
        this.templateRenderer.getDefaultTemplate();
    }

    const sampleData = this.templateRenderer.getSampleData();
    const rendered = this.templateRenderer.render(template, sampleData);

    return {
      rendered,
      template,
      sampleData,
    };
  }

  /**
   * DELETE /applications/:id/github/template
   * Reset the template back to default.
   */
  @Delete('applications/:id/github/template')
  @ApiOperation({ summary: 'Reset issue template to default' })
  @ApiParam({ name: 'id', description: 'Application UUID' })
  async resetTemplate(
    @Param('id') applicationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    await this.configService.updateSettings(applicationId, tenantId, {
      issueBodyTemplate: null,
    });

    return {
      template: this.templateRenderer.getDefaultTemplate(),
      isDefault: true,
      placeholders: this.templateRenderer.getPlaceholders(),
    };
  }
}
