import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { UpdateAiConfigDto } from './dto/update-ai-config.dto';
import Anthropic from '@anthropic-ai/sdk';

export interface AiConfigResponse {
  id: string;
  tenantId: string;
  provider: string;
  maskedApiKey: string | null;
  model: string;
  endpoint?: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getConfig(tenantId: string): Promise<AiConfigResponse | null> {
    const config = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return null;
    }

    // encryptedApiKey is auto-decrypted by Prisma encryption middleware
    const settings = config.settings as Record<string, unknown>;

    return {
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      maskedApiKey: this.maskApiKey(
        this.encryptionService.decrypt(config.encryptedApiKey),
      ),
      model: config.model,
      endpoint: settings?.endpoint as string | undefined,
      settings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async upsertConfig(
    tenantId: string,
    dto: UpdateAiConfigDto,
  ): Promise<AiConfigResponse> {
    const existing = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    const data: Record<string, unknown> = {};

    if (dto.apiKey) {
      data.encryptedApiKey = this.encryptionService.encrypt(dto.apiKey);
    }
    if (dto.model !== undefined) {
      data.model = dto.model;
    }

    // Merge endpoint and other settings
    const mergedSettings: Record<string, unknown> = {
      ...(existing?.settings as Record<string, unknown>),
      ...dto.settings,
    };
    if (dto.endpoint !== undefined) {
      mergedSettings.endpoint = dto.endpoint;
    }

    const existing = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    let config;

    if (existing) {
      config = await this.prisma.aiConfig.update({
        where: { tenantId },
        data,
      });
    } else {
      // Create new config
      const provider = dto.provider || AIProviderType.ANTHROPIC;

      // Ollama and Bedrock don't require API key (use local/IAM credentials)
      const noKeyRequired = [AIProviderType.OLLAMA, AIProviderType.BEDROCK];
      if (!noKeyRequired.includes(provider) && !dto.apiKey) {
        throw new BadRequestException(
          'API key is required when creating a new AI configuration',
        );
      }
      config = await this.prisma.aiConfig.create({
        data: {
          tenantId,
          provider,
          encryptedApiKey: dto.apiKey || '',
          model: dto.model || this.getDefaultModel(provider),
          settings: mergedSettings as Prisma.InputJsonValue,
        },
      });
    }

    const settings = config.settings as Record<string, unknown>;

    return {
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      maskedApiKey: this.maskApiKey(
        this.encryptionService.decrypt(config.encryptedApiKey),
      ),
      model: config.model,
      endpoint: settings?.endpoint as string | undefined,
      settings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private getDefaultModel(provider: AIProviderType): string {
    switch (provider) {
      case AIProviderType.OPENAI:
        return 'gpt-4o-mini';
      case AIProviderType.ANTHROPIC:
        return 'claude-sonnet-4-6';
      case AIProviderType.OLLAMA:
        return 'llama3.1';
      case AIProviderType.GEMINI:
        return 'gemini-2.0-flash';
      case AIProviderType.BEDROCK:
        return 'anthropic.claude-sonnet-4-6-v1:0';
      default:
        return 'claude-sonnet-4-6';
    }
  }

  async validateKey(
    apiKey?: string,
    provider?: AIProviderType,
    endpoint?: string,
    model?: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = new Anthropic({ apiKey });

      const config: AIProviderConfig = {
        provider: providerType as 'anthropic' | 'openai' | 'ollama' | 'gemini' | 'bedrock',
        apiKey,
        endpoint,
        model,
      };

      const providerInstance = this.providerFactory.create(config);
      const isValid = await providerInstance.validateConfig();

      if (!isValid) {
        return {
          valid: false,
          error: `Failed to validate ${providerType} configuration`,
        };
      }

      return { valid: true };
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      this.logger.warn(`API key validation failed: ${err.message}`);

      if (err.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      if (err.status === 403) {
        return {
          valid: false,
          error: 'API key does not have required permissions',
        };
      }
      if (err.status === 429) {
        // Rate-limited but the key itself is valid
        return { valid: true };
      }

      return {
        valid: false,
        error: err.message || 'Failed to validate configuration',
      };
    }
  }

  async getFullConfig(tenantId: string): Promise<{
    provider: string;
    apiKey: string;
    model: string;
    endpoint?: string;
  } | null> {
    const config = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.encryptedApiKey) {
      return null;
    }

    const settings = config.settings as Record<string, unknown>;

    return {
      provider: config.provider,
      apiKey: config.encryptedApiKey, // auto-decrypted by Prisma encryption middleware
      model: config.model,
      endpoint: settings?.endpoint as string | undefined,
    };
  }

  async getDecryptedApiKey(tenantId: string): Promise<string | null> {
    const config = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return null;
    }

    return this.encryptionService.decrypt(config.encryptedApiKey);
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return '****' + apiKey.slice(-4);
  }
}
