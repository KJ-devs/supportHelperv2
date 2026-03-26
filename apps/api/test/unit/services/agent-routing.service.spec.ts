import { Test, TestingModule } from '@nestjs/testing';
import { AgentRoutingService } from '../../../src/modules/agent-routing/agent-routing.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('AgentRoutingService', () => {
  let service: AgentRoutingService;
  let prisma: { agentDefinition: { findMany: jest.Mock } };

  const baseAgent = {
    id: 'agent-1',
    name: 'Security Agent',
    systemPrompt: 'You are a security expert.',
    toolset: ['read_file', 'search_code'],
    model: 'gpt-4o',
    temperature: 0.2,
    maxIterations: 10,
    isActive: true,
    isSystem: false,
    tenantId: 'tenant-123',
  };

  beforeEach(async () => {
    prisma = {
      agentDefinition: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRoutingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AgentRoutingService>(AgentRoutingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveAgent', () => {
    it('returns matching agent when type equals condition matches', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'type', operator: 'equals', value: 'bug' }],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: 'high',
        keywords: [],
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-1');
      expect(result?.name).toBe('Security Agent');
    });

    it('returns null when no agents match (fallback to default N2)', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'type', operator: 'equals', value: 'feature_request' }],
            matchMode: 'all',
            priority: 5,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });

      expect(result).toBeNull();
    });

    it('ignores inactive agents (isActive=false)', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([]);
      // The findMany already filters isActive:true at the DB level,
      // so returning an empty array simulates the inactive-agent case.

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });

      expect(result).toBeNull();
      expect(prisma.agentDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('higher priority agent wins when multiple match', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          id: 'agent-low',
          name: 'Low Priority Agent',
          triggerRules: {
            conditions: [{ field: 'type', operator: 'equals', value: 'bug' }],
            matchMode: 'all',
            priority: 1,
          },
        },
        {
          ...baseAgent,
          id: 'agent-high',
          name: 'High Priority Agent',
          triggerRules: {
            conditions: [{ field: 'type', operator: 'equals', value: 'bug' }],
            matchMode: 'all',
            priority: 99,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });

      expect(result?.id).toBe('agent-high');
    });

    it('matchMode "all" requires ALL conditions to be true', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [
              { field: 'type', operator: 'equals', value: 'bug' },
              { field: 'severity', operator: 'equals', value: 'critical' },
            ],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      // Only type matches, severity does not
      const noMatch = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: 'low',
        keywords: [],
      });
      expect(noMatch).toBeNull();

      // Both match
      const match = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: 'critical',
        keywords: [],
      });
      expect(match?.id).toBe('agent-1');
    });

    it('matchMode "any" requires ANY condition to be true', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [
              { field: 'type', operator: 'equals', value: 'security' },
              { field: 'severity', operator: 'equals', value: 'critical' },
            ],
            matchMode: 'any',
            priority: 10,
          },
        },
      ]);

      // Only severity matches
      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: 'critical',
        keywords: [],
      });
      expect(result?.id).toBe('agent-1');
    });

    it('"contains" operator works on keywords', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'keywords', operator: 'contains', value: 'auth' }],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: null,
        severity: null,
        keywords: ['authentication', 'login'],
      });
      // 'authentication'.includes('auth') === true
      expect(result?.id).toBe('agent-1');
    });

    it('"in" operator works on type field', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'type', operator: 'in', value: ['bug', 'crash', 'error'] }],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'crash',
        severity: null,
        keywords: [],
      });
      expect(result?.id).toBe('agent-1');

      // Type not in list
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'type', operator: 'in', value: ['bug', 'crash'] }],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);
      const noMatch = await service.resolveAgent('tenant-123', {
        type: 'feature_request',
        severity: null,
        keywords: [],
      });
      expect(noMatch).toBeNull();
    });

    it('"in" operator works on severity field', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'severity', operator: 'in', value: ['high', 'critical'] }],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: null,
        severity: 'high',
        keywords: [],
      });
      expect(result?.id).toBe('agent-1');
    });

    it('system agents (isSystem=true) are included in evaluation', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          isSystem: true,
          tenantId: null,
          triggerRules: {
            conditions: [{ field: 'type', operator: 'equals', value: 'bug' }],
            matchMode: 'all',
            priority: 5,
          },
        },
      ]);

      // Verify findMany is called with OR clause covering isSystem
      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });

      expect(prisma.agentDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ tenantId: 'tenant-123' }, { isSystem: true }],
          }),
        })
      );
      expect(result?.id).toBe('agent-1');
    });

    it('empty conditions array returns no match', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: 'high',
        keywords: ['auth'],
      });
      expect(result).toBeNull();
    });

    it('agents with null triggerRules are filtered out', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: null,
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });
      expect(result).toBeNull();
    });

    it('returns mapped ResolvedAgent shape (no extra prisma fields)', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'type', operator: 'equals', value: 'bug' }],
            matchMode: 'all',
            priority: 1,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });

      expect(result).toEqual({
        id: 'agent-1',
        name: 'Security Agent',
        systemPrompt: 'You are a security expert.',
        toolset: ['read_file', 'search_code'],
        model: 'gpt-4o',
        temperature: 0.2,
        maxIterations: 10,
      });
      // Must NOT include tenantId or isActive
      expect(result).not.toHaveProperty('tenantId');
      expect(result).not.toHaveProperty('isActive');
    });

    it('field value null does not match any operator', async () => {
      prisma.agentDefinition.findMany.mockResolvedValue([
        {
          ...baseAgent,
          triggerRules: {
            conditions: [{ field: 'severity', operator: 'equals', value: 'high' }],
            matchMode: 'all',
            priority: 10,
          },
        },
      ]);

      const result = await service.resolveAgent('tenant-123', {
        type: 'bug',
        severity: null,
        keywords: [],
      });
      expect(result).toBeNull();
    });
  });
});
