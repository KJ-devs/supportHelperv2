import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  ModelTieringService,
  DEFAULT_TIERS,
  AITask,
} from '../../../src/ai/model-tiering.service';

describe('ModelTieringService', () => {
  let service: ModelTieringService;
  let configService: jest.Mocked<ConfigService>;
  let prisma: { aiConfig: { findUnique: jest.Mock } };

  const TENANT_ID = 'tenant-abc';

  beforeEach(async () => {
    prisma = {
      aiConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelTieringService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ModelTieringService);
    configService = module.get(ConfigService);
  });

  // ── Default tier routing ───────────────────────────────

  describe('default tier routing', () => {
    beforeEach(() => {
      // Make Anthropic and Gemini keys available via env
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-test';
        if (key === 'GOOGLE_AI_API_KEY') return 'gemini-test-key';
        if (key === 'OPENAI_API_KEY') return 'sk-openai-test';
        return undefined;
      });
    });

    it.each<[AITask, string, string]>([
      ['classification', 'anthropic', 'claude-haiku-4-5-20251001'],
      ['vision', 'gemini', 'gemini-2.0-flash'],
      ['enrichment', 'gemini', 'gemini-2.0-flash'],
      ['investigation', 'anthropic', 'claude-sonnet-4-6'],
      ['chat', 'anthropic', 'claude-sonnet-4-6'],
    ])(
      'routes %s → %s/%s',
      async (task, expectedProvider, expectedModel) => {
        const result = await service.resolveForTask(task);

        expect(result.providerConfig.provider).toBe(expectedProvider);
        expect(result.providerConfig.model).toBe(expectedModel);
        expect(result.reason).toContain('default tier');
      },
    );

    it('returns correct maxTokens and temperature from default tier', async () => {
      const result = await service.resolveForTask('classification');

      expect(result.tier.maxTokens).toBe(DEFAULT_TIERS.classification.maxTokens);
      expect(result.tier.temperature).toBe(DEFAULT_TIERS.classification.temperature);
    });

    it('provides API key from system env var', async () => {
      const result = await service.resolveForTask('classification');

      expect(result.providerConfig.apiKey).toBe('sk-ant-test');
    });
  });

  // ── Tenant config ──────────────────────────────────────

  describe('tenant-specific routing', () => {
    it('uses tenant API key when tenant provider matches tier provider', async () => {
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'anthropic',
        encryptedApiKey: 'sk-ant-tenant-key',
        model: 'claude-sonnet-4-6',
        settings: {},
      });

      const result = await service.resolveForTask('classification', TENANT_ID);

      expect(result.providerConfig.apiKey).toBe('sk-ant-tenant-key');
      expect(result.providerConfig.provider).toBe('anthropic');
    });

    it('uses system key when tier provider differs from tenant provider', async () => {
      // Tenant uses Anthropic, but vision tier wants Gemini
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'anthropic',
        encryptedApiKey: 'sk-ant-tenant-key',
        model: 'claude-sonnet-4-6',
        settings: {},
      });

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'GOOGLE_AI_API_KEY') return 'gemini-system-key';
        return undefined;
      });

      const result = await service.resolveForTask('vision', TENANT_ID);

      expect(result.providerConfig.provider).toBe('gemini');
      expect(result.providerConfig.apiKey).toBe('gemini-system-key');
    });
  });

  // ── Custom tenant tiers ────────────────────────────────

  describe('custom tenant tiers', () => {
    it('uses custom tier from tenant settings', async () => {
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'openai',
        encryptedApiKey: 'sk-openai-key',
        model: 'gpt-4o',
        settings: {
          tiers: {
            classification: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              maxTokens: 50,
              temperature: 0.05,
            },
          },
        },
      });

      const result = await service.resolveForTask('classification', TENANT_ID);

      expect(result.providerConfig.provider).toBe('openai');
      expect(result.providerConfig.model).toBe('gpt-4o-mini');
      expect(result.tier.maxTokens).toBe(50);
      expect(result.tier.temperature).toBe(0.05);
      expect(result.reason).toContain('custom tenant tier');
    });

    it('merges partial custom tier with defaults', async () => {
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'anthropic',
        encryptedApiKey: 'sk-ant-key',
        model: 'claude-sonnet-4-6',
        settings: {
          tiers: {
            classification: {
              // Only override model, keep default provider/maxTokens/temperature
              model: 'claude-sonnet-4-6',
            },
          },
        },
      });

      const result = await service.resolveForTask('classification', TENANT_ID);

      expect(result.providerConfig.model).toBe('claude-sonnet-4-6');
      // Provider falls back to default tier's provider (anthropic)
      expect(result.providerConfig.provider).toBe('anthropic');
      expect(result.tier.maxTokens).toBe(DEFAULT_TIERS.classification.maxTokens);
    });
  });

  // ── Fallback behavior ──────────────────────────────────

  describe('fallback when tier provider unavailable', () => {
    it('falls back to tenant default when tier provider has no key', async () => {
      // No system keys at all
      (configService.get as jest.Mock).mockReturnValue(undefined);

      // Tenant has OpenAI configured
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'openai',
        encryptedApiKey: 'sk-openai-tenant',
        model: 'gpt-4o',
        settings: {},
      });

      // Vision tier wants Gemini, but no Gemini key → fall back to tenant's OpenAI
      const result = await service.resolveForTask('vision', TENANT_ID);

      expect(result.providerConfig.provider).toBe('openai');
      expect(result.providerConfig.apiKey).toBe('sk-openai-tenant');
      expect(result.reason).toContain('fallback');
      expect(result.reason).toContain('gemini unavailable');
    });

    it('falls back to system anthropic when no tenant config', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ANTHROPIC_API_KEY') return 'sk-ant-system';
        return undefined;
      });

      // Vision tier wants Gemini, no Gemini key, no tenant → system anthropic
      const result = await service.resolveForTask('vision');

      expect(result.providerConfig.provider).toBe('anthropic');
      expect(result.providerConfig.apiKey).toBe('sk-ant-system');
      expect(result.reason).toContain('fallback');
      expect(result.reason).toContain('system anthropic');
    });

    it('falls back to system openai when no anthropic key', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return 'sk-openai-system';
        return undefined;
      });

      const result = await service.resolveForTask('vision');

      expect(result.providerConfig.provider).toBe('openai');
      expect(result.providerConfig.apiKey).toBe('sk-openai-system');
      expect(result.reason).toContain('system openai');
    });

    it('throws when no provider is available at all', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(service.resolveForTask('vision')).rejects.toThrow(
        'No AI provider available for task "vision"',
      );
    });
  });

  // ── Special provider types ─────────────────────────────

  describe('special provider key resolution', () => {
    it('returns iam-credentials for bedrock when AWS_REGION is set', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        return undefined;
      });

      expect(service.getSystemApiKey('bedrock')).toBe('iam-credentials');
    });

    it('returns undefined for bedrock when AWS_REGION is not set', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      expect(service.getSystemApiKey('bedrock')).toBeUndefined();
    });

    it('returns "local" for ollama (always available)', () => {
      expect(service.getSystemApiKey('ollama')).toBe('local');
    });
  });

  // ── Edge cases ─────────────────────────────────────────

  describe('edge cases', () => {
    it('handles tenant config with empty settings gracefully', async () => {
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'anthropic',
        encryptedApiKey: 'sk-ant-key',
        model: 'claude-sonnet-4-6',
        settings: null,
      });

      const result = await service.resolveForTask('classification', TENANT_ID);

      // Uses default tier, gets key from tenant config
      expect(result.providerConfig.provider).toBe('anthropic');
      expect(result.tier.model).toBe('claude-haiku-4-5-20251001');
    });

    it('handles tenant with no API key (empty string) as null', async () => {
      prisma.aiConfig.findUnique.mockResolvedValue({
        provider: 'anthropic',
        encryptedApiKey: '',
        model: 'claude-sonnet-4-6',
        settings: {},
      });

      // No system keys → should throw
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(
        service.resolveForTask('classification', TENANT_ID),
      ).rejects.toThrow('No AI provider available');
    });

    it('does not query prisma when tenantId is not provided', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'ANTHROPIC_API_KEY') return 'sk-ant';
        return undefined;
      });

      await service.resolveForTask('chat');

      expect(prisma.aiConfig.findUnique).not.toHaveBeenCalled();
    });
  });
});
