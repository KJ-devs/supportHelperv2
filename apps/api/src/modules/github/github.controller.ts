import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GithubService } from './github.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CreateIssueDto } from './dto/create-issue.dto';

@ApiTags('GitHub Integration')
@ApiBearerAuth()
@Controller('github')
@UseGuards(JwtAuthGuard)
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Get GitHub OAuth authorization URL' })
  getAuthUrl(@CurrentTenant() tenantId: string) {
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');
    return {
      url: this.githubService.getAuthorizationUrl(state),
    };
  }

  @Get('callback')
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const { tenantId } = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8'),
    );

    const accessToken = await this.githubService.exchangeCodeForToken(code);
    const repositories =
      await this.githubService.getUserRepositories(accessToken);

    // Store connection (simplified - should use proper service)
    // await this.githubService.saveConnection(tenantId, accessToken, repositories);

    return {
      success: true,
      repositories,
    };
  }

  @Post('issues')
  @ApiOperation({ summary: 'Create GitHub issue from ticket' })
  async createIssue(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateIssueDto,
  ) {
    return this.githubService.createIssueFromTicket(
      dto.ticketId,
      tenantId,
      dto.repository,
      dto.accessToken,
    );
  }

  @Post('sync/:ticketId')
  @ApiOperation({ summary: 'Sync ticket to GitHub issue' })
  async syncTicket(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
  ) {
    await this.githubService.syncTicketToIssue(ticketId, tenantId);
    return { success: true };
  }
}
