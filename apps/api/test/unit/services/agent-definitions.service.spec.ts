import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  AgentDefinitionsService,
  VALID_TOOLS,
} from '../../../src/modules/agent-definitions/agent-definitions.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AgentDefinitionsService', () => {
  let service: AgentDefinitionsService;
  let prisma: jest.Mocked<PrismaService>;

  const TENANT_ID = 'tenant-123';
  const OTHER_TENANT_ID = 'tenant-999';
  const AGENT_ID = 'agent-def-123';

  const mockAgentDefinition = {
    id: AGENT_ID,
    tenantId: TENANT_ID,
    name: 'Test Agent',
    description: 'A test agent',
    systemPrompt: 'You are a helpful assistant.',
    toolset: ['search_similar_tickets', 'get_ticket_details'],
    triggerRules: null,
    model: 'claude-sonnet-4-5',
    temperature: 0.7,
    maxIterations: 15,
    isActive: true,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSystemAgent = {
    ...mockAgentDefinition,
    id: 'system-agent-1',
    tenantId: null,
    name: 'System Agent',
    isSystem: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentDefinitionsService,
        {
          provide: PrismaService,
          useValue: {
            agentDefinition: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AgentDefinitionsService>(AgentDefinitionsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an agent definition', async () => {
      const dto = {
        name: 'Test Agent',
        systemPrompt: 'You are helpful.',
        toolset: ['search_similar_tickets'],
      };

      (prisma.agentDefinition.create as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      const result = await service.create(TENANT_ID, dto);

      expect(prisma.agentDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          name: dto.name,
          systemPrompt: dto.systemPrompt,
          toolset: dto.toolset,
          isActive: true,
        }),
      });
      expect(result).toEqual(mockAgentDefinition);
    });

    it('should create without toolset (defaults to empty array)', async () => {
      const dto = {
        name: 'Minimal Agent',
        systemPrompt: 'You are helpful.',
      };

      (prisma.agentDefinition.create as jest.Mock).mockResolvedValue({
        ...mockAgentDefinition,
        toolset: [],
      });

      await service.create(TENANT_ID, dto);

      expect(prisma.agentDefinition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ toolset: [] }),
      });
    });

    it('should throw BadRequestException for invalid tools', async () => {
      const dto = {
        name: 'Bad Agent',
        systemPrompt: 'You are helpful.',
        toolset: ['search_similar_tickets', 'invalid_tool', 'another_bad_tool'],
      };

      await expect(service.create(TENANT_ID, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.agentDefinition.create).not.toHaveBeenCalled();
    });

    it('should accept all valid tools', async () => {
      const dto = {
        name: 'Full Tools Agent',
        systemPrompt: 'You are helpful.',
        toolset: [...VALID_TOOLS],
      };

      (prisma.agentDefinition.create as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      await expect(service.create(TENANT_ID, dto)).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return tenant agents and system agents', async () => {
      (prisma.agentDefinition.findMany as jest.Mock).mockResolvedValue([
        mockSystemAgent,
        mockAgentDefinition,
      ]);

      const result = await service.findAll(TENANT_ID);

      expect(prisma.agentDefinition.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ tenantId: TENANT_ID }, { isSystem: true }],
        },
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no agents found', async () => {
      (prisma.agentDefinition.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a tenant-owned agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      const result = await service.findOne(AGENT_ID, TENANT_ID);

      expect(prisma.agentDefinition.findFirst).toHaveBeenCalledWith({
        where: {
          id: AGENT_ID,
          OR: [{ tenantId: TENANT_ID }, { isSystem: true }],
        },
      });
      expect(result).toEqual(mockAgentDefinition);
    });

    it('should return a system agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockSystemAgent,
      );

      const result = await service.findOne(mockSystemAgent.id, TENANT_ID);

      expect(result).toEqual(mockSystemAgent);
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for another tenant agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne(AGENT_ID, OTHER_TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a tenant-owned agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      const updated = { ...mockAgentDefinition, name: 'Updated Agent' };
      (prisma.agentDefinition.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update(AGENT_ID, TENANT_ID, {
        name: 'Updated Agent',
      });

      expect(prisma.agentDefinition.update).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        data: expect.objectContaining({ name: 'Updated Agent' }),
      });
      expect(result.name).toBe('Updated Agent');
    });

    it('should throw ForbiddenException when updating a system agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockSystemAgent,
      );

      await expect(
        service.update(mockSystemAgent.id, TENANT_ID, { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.agentDefinition.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid tools on update', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      await expect(
        service.update(AGENT_ID, TENANT_ID, { toolset: ['bad_tool'] }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.agentDefinition.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a tenant-owned agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );
      (prisma.agentDefinition.delete as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      await service.delete(AGENT_ID, TENANT_ID);

      expect(prisma.agentDefinition.delete).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
      });
    });

    it('should throw ForbiddenException when deleting a system agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockSystemAgent,
      );

      await expect(
        service.delete(mockSystemAgent.id, TENANT_ID),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.agentDefinition.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when agent not found', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.delete('nonexistent-id', TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggle', () => {
    it('should flip isActive from true to false', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockAgentDefinition,
      );

      const toggled = { ...mockAgentDefinition, isActive: false };
      (prisma.agentDefinition.update as jest.Mock).mockResolvedValue(toggled);

      const result = await service.toggle(AGENT_ID, TENANT_ID);

      expect(prisma.agentDefinition.update).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should flip isActive from false to true', async () => {
      const inactiveAgent = { ...mockAgentDefinition, isActive: false };
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        inactiveAgent,
      );

      const toggled = { ...inactiveAgent, isActive: true };
      (prisma.agentDefinition.update as jest.Mock).mockResolvedValue(toggled);

      const result = await service.toggle(AGENT_ID, TENANT_ID);

      expect(prisma.agentDefinition.update).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });

    it('should throw ForbiddenException when toggling a system agent', async () => {
      (prisma.agentDefinition.findFirst as jest.Mock).mockResolvedValue(
        mockSystemAgent,
      );

      await expect(
        service.toggle(mockSystemAgent.id, TENANT_ID),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.agentDefinition.update).not.toHaveBeenCalled();
    });
  });
});
