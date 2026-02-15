import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CodebaseIndexerService } from './services/codebase-indexer.service';
import { CodebaseSearchService } from './services/codebase-search.service';
import { SearchCodebaseDto } from './dto/search-codebase.dto';
import { ReindexDto } from './dto/reindex.dto';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('codebase-index')
@Controller('api/v1/applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CodebaseIndexController {
  constructor(
    private readonly indexerService: CodebaseIndexerService,
    private readonly searchService: CodebaseSearchService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/codebase/reindex')
  @ApiOperation({ summary: 'Trigger codebase re-indexing for an application' })
  @ApiResponse({ status: 200, description: 'Indexing job queued' })
  @ApiResponse({ status: 400, description: 'No GitHub repo linked' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async reindex(
    @Param('id') applicationId: string,
    @Body() dto: ReindexDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    const tenantId = req.user.tenantId;
    await this.verifyApplicationAccess(applicationId, tenantId);

    let jobId: string;
    if (dto.sinceCommitSha) {
      jobId = await this.indexerService.queueIncrementalIndex(
        applicationId,
        tenantId,
        dto.sinceCommitSha,
      );
    } else {
      jobId = await this.indexerService.queueFullIndex(applicationId, tenantId);
    }

    return { jobId, message: 'Indexing queued' };
  }

  @Get(':id/codebase/status')
  @ApiOperation({ summary: 'Get codebase indexing status' })
  @ApiResponse({ status: 200, description: 'Current indexing status' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getStatus(
    @Param('id') applicationId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    const tenantId = req.user.tenantId;
    await this.verifyApplicationAccess(applicationId, tenantId);

    const status = await this.indexerService.getStatus(applicationId);
    return status ?? { status: 'not_indexed' };
  }

  @Post(':id/codebase/search')
  @ApiOperation({ summary: 'Search codebase using natural language' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async search(
    @Param('id') applicationId: string,
    @Body() dto: SearchCodebaseDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    const tenantId = req.user.tenantId;
    await this.verifyApplicationAccess(applicationId, tenantId);

    return this.searchService.findRelevantFiles(applicationId, dto.query, dto.limit);
  }

  private async verifyApplicationAccess(applicationId: string, tenantId: string): Promise<void> {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
  }
}
