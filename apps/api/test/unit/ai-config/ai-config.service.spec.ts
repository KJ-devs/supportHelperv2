import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiConfigService } from '../../../src/modules/ai-config/ai-config.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AIProviderFactory } from '../../../src/ai/providers/ai-provider.factory';

describe('AiConfigService', () => {
  let service: AiConfigService;
  let prisma: jest.Mocked<PrismaService>;
  let providerFactory: jest.Mocked<AIProviderFactory>;

  const tenantId = 'tenant-123';
  // Mock data simulates values after Prisma middleware auto-decryption
  const mockConfig = {
    id: 'config-123',
    tenantId,
    provider: 'anthropic',
    encryptedApiKey: 'sk-ant-api03-test-key-1234',
    model: 'claude-sonnet-4-20250514',
    settings: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiConfigService,
        {
          provide: PrismaService,
          useValue: {
            aiConfig: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: AIProviderFactory,
          useValue: {
            create: jest.fn().mockReturnValue({
              validateConfig: jest.fn().mockResolvedValue(true),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiConfigService>(AiConfigService);
    prisma = module.get(PrismaService);
    providerFactory = module.get(AIProviderFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return null when no config exists', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getConfig(tenantId);

      expect(result).toBeNull();
      expect(prisma.aiConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId },
      });
    });

    it('should return config with masked API key', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getConfig(tenantId);

      expect(result).not.toBeNull();
      expect(result!.maskedApiKey).toBe('****1234');
      expect(result!.provider).toBe('anthropic');
      expect(result!.model).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('upsertConfig', () => {
    it('should create config when none exists', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.aiConfig.create as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.upsertConfig(tenantId, {
        apiKey: 'sk-ant-api03-new-key',
      });

      // Plaintext key is passed; Prisma middleware auto-encrypts on write
      expect(prisma.aiConfig.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          provider: 'anthropic',
          encryptedApiKey: 'sk-ant-api03-new-key',
          model: 'claude-sonnet-4-5-20250929',
          settings: {},
        },
      });
      expect(result.maskedApiKey).toBe('****1234');
    });

    it('should throw when creating without API key', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.upsertConfig(tenantId, { model: 'claude-sonnet-4-20250514' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing config', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.aiConfig.update as jest.Mock).mockResolvedValue({
        ...mockConfig,
        model: 'claude-opus-4-20250514',
      });

      const result = await service.upsertConfig(tenantId, {
        model: 'claude-opus-4-20250514',
      });

      expect(prisma.aiConfig.update).toHaveBeenCalledWith({
        where: { tenantId },
        data: { model: 'claude-opus-4-20250514', settings: {} },
      });
      expect(result.model).toBe('claude-opus-4-20250514');
    });

    it('should update API key on existing config', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.aiConfig.update as jest.Mock).mockResolvedValue(mockConfig);

      await service.upsertConfig(tenantId, {
        apiKey: 'sk-ant-api03-updated-key',
      });

      // Plaintext key is passed; Prisma middleware auto-encrypts on write
      expect(prisma.aiConfig.update).toHaveBeenCalledWith({
        where: { tenantId },
        data: { encryptedApiKey: 'sk-ant-api03-updated-key', settings: {} },
      });
    });

    it('should update settings', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.aiConfig.update as jest.Mock).mockResolvedValue({
        ...mockConfig,
        settings: { maxTokens: 4096 },
      });

      const result = await service.upsertConfig(tenantId, {
        settings: { maxTokens: 4096 },
      });

      expect(result.settings).toEqual({ maxTokens: 4096 });
    });
  });

  describe('validateKey', () => {
    it('should return valid for a working key', async () => {
      const result = await service.validateKey('sk-ant-api03-valid-key');

      expect(result.valid).toBe(true);
      expect(providerFactory.create).toHaveBeenCalled();
    });

    it('should return invalid for a 401 error', async () => {
      (providerFactory.create as jest.Mock).mockReturnValueOnce({
        validateConfig: jest.fn().mockRejectedValue({ status: 401, message: 'Invalid API key' }),
      });

      const result = await service.validateKey('sk-ant-api03-bad-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should return valid for a 429 rate limit error', async () => {
      (providerFactory.create as jest.Mock).mockReturnValueOnce({
        validateConfig: jest.fn().mockRejectedValue({ status: 429, message: 'Rate limited' }),
      });

      const result = await service.validateKey('sk-ant-api03-rate-limited');

      expect(result.valid).toBe(true);
    });

    it('should return invalid when validateConfig returns false', async () => {
      (providerFactory.create as jest.Mock).mockReturnValueOnce({
        validateConfig: jest.fn().mockResolvedValue(false),
      });

      const result = await service.validateKey('sk-ant-api03-invalid');

      expect(result.valid).toBe(false);
    });
  });

  describe('getDecryptedApiKey', () => {
    it('should return null when no config', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getDecryptedApiKey(tenantId);

      expect(result).toBeNull();
    });

    it('should return decrypted key', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getDecryptedApiKey(tenantId);

      // Value is already decrypted by Prisma middleware
      expect(result).toBe('sk-ant-api03-test-key-1234');
    });
  });
});
