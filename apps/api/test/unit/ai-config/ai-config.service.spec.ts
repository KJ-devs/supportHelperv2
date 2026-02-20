import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiConfigService } from '../../../src/modules/ai-config/ai-config.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EncryptionService } from '../../../src/common/services/encryption.service';

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'ok' }],
        }),
      },
    })),
  };
});

describe('AiConfigService', () => {
  let service: AiConfigService;
  let prisma: jest.Mocked<PrismaService>;
  let encryptionService: jest.Mocked<EncryptionService>;

  const tenantId = 'tenant-123';
  const mockConfig = {
    id: 'config-123',
    tenantId,
    provider: 'anthropic',
    encryptedApiKey: 'encrypted:data:here',
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
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn().mockReturnValue('encrypted:data:here'),
            decrypt: jest.fn().mockReturnValue('sk-ant-api03-test-key-1234'),
          },
        },
      ],
    }).compile();

    service = module.get<AiConfigService>(AiConfigService);
    prisma = module.get(PrismaService);
    encryptionService = module.get(EncryptionService);
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
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted:data:here');
    });
  });

  describe('upsertConfig', () => {
    it('should create config when none exists', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.aiConfig.create as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.upsertConfig(tenantId, {
        apiKey: 'sk-ant-api03-new-key',
      });

      expect(prisma.aiConfig.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          provider: 'anthropic',
          encryptedApiKey: 'sk-ant-api03-new-key',
          model: 'claude-sonnet-4-6',
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
        data: { model: 'claude-opus-4-20250514' },
      });
      expect(result.model).toBe('claude-opus-4-20250514');
    });

    it('should update API key on existing config', async () => {
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prisma.aiConfig.update as jest.Mock).mockResolvedValue(mockConfig);

      await service.upsertConfig(tenantId, {
        apiKey: 'sk-ant-api03-updated-key',
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        'sk-ant-api03-updated-key',
      );
      expect(prisma.aiConfig.update).toHaveBeenCalledWith({
        where: { tenantId },
        data: { encryptedApiKey: 'encrypted:data:here' },
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
    });

    it('should return invalid for a 401 error', async () => {
      const Anthropic = require('@anthropic-ai/sdk').default;
      Anthropic.mockImplementationOnce(() => ({
        messages: {
          create: jest.fn().mockRejectedValue({ status: 401, message: 'Invalid API key' }),
        },
      }));

      const result = await service.validateKey('sk-ant-api03-bad-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should return valid for a 429 rate limit error', async () => {
      const Anthropic = require('@anthropic-ai/sdk').default;
      Anthropic.mockImplementationOnce(() => ({
        messages: {
          create: jest.fn().mockRejectedValue({ status: 429, message: 'Rate limited' }),
        },
      }));

      const result = await service.validateKey('sk-ant-api03-rate-limited');

      expect(result.valid).toBe(true);
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

      expect(result).toBe('sk-ant-api03-test-key-1234');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted:data:here');
    });
  });
});
