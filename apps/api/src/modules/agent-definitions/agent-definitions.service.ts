import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDefinitionDto } from './dto/create-agent-definition.dto';
import { UpdateAgentDefinitionDto } from './dto/update-agent-definition.dto';
import { AgentDefinition, Prisma } from '@prisma/client';

export const VALID_TOOLS = [
  'read_file',
  'list_directory',
  'search_code',
  'search_codebase_semantic',
  'get_repo_structure',
  'get_file_history',
  'get_file_blame',
  'list_repos',
  'search_similar_tickets',
  'get_ticket_details',
  'update_diagnosis',
  'update_ticket_status',
  'escalate_to_human',
  'create_branch',
  'write_file',
  'edit_file',
  'create_pull_request',
] as const;

@Injectable()
export class AgentDefinitionsService {
  private readonly logger = new Logger(AgentDefinitionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    dto: CreateAgentDefinitionDto,
  ): Promise<AgentDefinition> {
    if (dto.toolset?.length) {
      this.validateToolset(dto.toolset);
    }

    return this.prisma.agentDefinition.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        toolset: dto.toolset ?? [],
        triggerRules: (dto.triggerRules as Prisma.InputJsonValue) ?? undefined,
        model: dto.model,
        temperature: dto.temperature,
        maxIterations: dto.maxIterations,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(tenantId: string): Promise<AgentDefinition[]> {
    return this.prisma.agentDefinition.findMany({
      where: {
        OR: [{ tenantId }, { isSystem: true }],
      },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string): Promise<AgentDefinition> {
    const agent = await this.prisma.agentDefinition.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { isSystem: true }],
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent definition ${id} not found`);
    }

    return agent;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAgentDefinitionDto,
  ): Promise<AgentDefinition> {
    const agent = await this.findOne(id, tenantId);

    if (agent.isSystem) {
      throw new ForbiddenException('Cannot modify system agent definitions');
    }

    if (dto.toolset?.length) {
      this.validateToolset(dto.toolset);
    }

    return this.prisma.agentDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        toolset: dto.toolset,
        triggerRules: (dto.triggerRules as Prisma.InputJsonValue) ?? undefined,
        model: dto.model,
        temperature: dto.temperature,
        maxIterations: dto.maxIterations,
        isActive: dto.isActive,
      },
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const agent = await this.findOne(id, tenantId);

    if (agent.isSystem) {
      throw new ForbiddenException('Cannot delete system agent definitions');
    }

    await this.prisma.agentDefinition.delete({ where: { id } });
    this.logger.log(`Deleted agent definition ${id} for tenant ${tenantId}`);
  }

  async toggle(id: string, tenantId: string): Promise<AgentDefinition> {
    const agent = await this.findOne(id, tenantId);

    if (agent.isSystem) {
      throw new ForbiddenException('Cannot toggle system agent definitions');
    }

    return this.prisma.agentDefinition.update({
      where: { id },
      data: { isActive: !agent.isActive },
    });
  }

  private validateToolset(toolset: string[]): void {
    const invalidTools = toolset.filter(
      (tool) => !(VALID_TOOLS as readonly string[]).includes(tool),
    );

    if (invalidTools.length > 0) {
      throw new BadRequestException(
        `Invalid tools: ${invalidTools.join(', ')}. Valid tools are: ${VALID_TOOLS.join(', ')}`,
      );
    }
  }
}
