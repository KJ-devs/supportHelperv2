import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { GithubIssuesService } from '../services/github-issues.service';
import { CreateGithubIssueDto } from '../dto';

@ApiTags('Ticket GitHub Integration')
@ApiBearerAuth()
@Controller('tickets/:ticketId/github')
@UseGuards(JwtAuthGuard)
export class TicketGithubController {
  constructor(private readonly issuesService: GithubIssuesService) {}

  /**
   * POST /tickets/:id/github/create-issue
   * Create a GitHub issue from a ticket
   */
  @Post('create-issue')
  @ApiOperation({ summary: 'Create GitHub issue from ticket' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  async createIssue(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateGithubIssueDto
  ) {
    return this.issuesService.createIssueFromTicket(ticketId, tenantId, dto);
  }

  /**
   * GET /tickets/:id/github/issues
   * Get linked GitHub issues for a ticket
   */
  @Get('issues')
  @ApiOperation({ summary: 'Get linked GitHub issues' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  async getLinkedIssues(@CurrentTenant() tenantId: string, @Param('ticketId') ticketId: string) {
    const issues = await this.issuesService.getLinkedIssues(ticketId, tenantId);
    return { issues };
  }

  /**
   * GET /tickets/:id/github/related
   * Search for related GitHub issues
   */
  @Get('related')
  @ApiOperation({ summary: 'Search related GitHub issues' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  async findRelatedIssues(
    @CurrentTenant() tenantId: string,
    @Param('ticketId') ticketId: string,
    @Query('repository') repository?: string
  ) {
    return this.issuesService.findRelatedIssues(ticketId, tenantId, repository);
  }

  /**
   * POST /tickets/:id/github/sync
   * Sync ticket state to linked GitHub issues
   */
  @Post('sync')
  @ApiOperation({ summary: 'Sync ticket to GitHub issues' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  async syncTicket(@CurrentTenant() tenantId: string, @Param('ticketId') ticketId: string) {
    await this.issuesService.syncTicketToIssue(ticketId, tenantId);
    return { success: true };
  }

  /**
   * DELETE /tickets/:id/github/issues/:issueId
   * Unlink a GitHub issue from ticket
   */
  @Delete('issues/:issueId')
  @ApiOperation({ summary: 'Unlink GitHub issue from ticket' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiParam({ name: 'issueId', description: 'GitHub issue link ID' })
  async unlinkIssue(@CurrentTenant() tenantId: string, @Param('issueId') issueId: string) {
    await this.issuesService.unlinkIssue(issueId, tenantId);
    return { success: true };
  }
}
