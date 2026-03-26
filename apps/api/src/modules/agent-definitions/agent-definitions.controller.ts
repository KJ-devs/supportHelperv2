import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AgentDefinitionsService } from './agent-definitions.service';
import { CreateAgentDefinitionDto } from './dto/create-agent-definition.dto';
import { UpdateAgentDefinitionDto } from './dto/update-agent-definition.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Agent Definitions')
@ApiBearerAuth()
@Controller('agent-definitions')
@UseGuards(JwtAuthGuard)
export class AgentDefinitionsController {
  constructor(private readonly service: AgentDefinitionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent definition' })
  @ApiResponse({ status: 201, description: 'Agent definition created' })
  @ApiResponse({ status: 400, description: 'Invalid input or invalid tools' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateAgentDefinitionDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all agent definitions for the tenant (includes system agents)' })
  @ApiResponse({ status: 200, description: 'List of agent definitions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single agent definition' })
  @ApiParam({ name: 'id', description: 'Agent definition UUID' })
  @ApiResponse({ status: 200, description: 'Agent definition found' })
  @ApiResponse({ status: 404, description: 'Agent definition not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agent definition' })
  @ApiParam({ name: 'id', description: 'Agent definition UUID' })
  @ApiResponse({ status: 200, description: 'Agent definition updated' })
  @ApiResponse({ status: 400, description: 'Invalid tools' })
  @ApiResponse({ status: 403, description: 'Cannot modify system agents' })
  @ApiResponse({ status: 404, description: 'Agent definition not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateAgentDefinitionDto,
  ) {
    return this.service.update(id, tenantId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent definition' })
  @ApiParam({ name: 'id', description: 'Agent definition UUID' })
  @ApiResponse({ status: 204, description: 'Agent definition deleted' })
  @ApiResponse({ status: 403, description: 'Cannot delete system agents' })
  @ApiResponse({ status: 404, description: 'Agent definition not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async delete(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.delete(id, tenantId);
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle isActive on an agent definition' })
  @ApiParam({ name: 'id', description: 'Agent definition UUID' })
  @ApiResponse({ status: 200, description: 'Agent definition toggled' })
  @ApiResponse({ status: 403, description: 'Cannot toggle system agents' })
  @ApiResponse({ status: 404, description: 'Agent definition not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async toggle(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.toggle(id, tenantId);
  }
}
