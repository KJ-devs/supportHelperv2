import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateApplicationDto, UpdateApplicationDto } from './dto/application.dto';

@ApiTags('applications')
@Controller('applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new application' })
  async create(
    @Body() dto: CreateApplicationDto,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.applicationsService.create(req.user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all applications' })
  async findAll(@Request() req: { user: { tenantId: string } }) {
    return this.applicationsService.findByTenant(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application by ID' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.applicationsService.findOne(id, req.user.tenantId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get application stats' })
  async getStats(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.applicationsService.getStats(id, req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update application' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.applicationsService.update(id, req.user.tenantId, dto);
  }

  @Post(':id/regenerate-key')
  @ApiOperation({ summary: 'Regenerate SDK key' })
  async regenerateKey(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.applicationsService.regenerateSdkKey(id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete application' })
  async delete(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } }
  ) {
    return this.applicationsService.delete(id, req.user.tenantId);
  }
}
