import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAiConfigDto, AIProviderType } from './dto/update-ai-config.dto';
import { AIProviderFactory } from '../../ai/providers/ai-provider.factory';
import { AIProviderConfig } from '../../ai/providers/ai-provider.types';

export interface AiConfigResponse {
  id: string;
  tenantId: string;
  provider: string;
  maskedApiKey: string | null;
  model: string;
  endpoint?: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: AIProviderFactory,
  ) {}

  async getConfig(tenantId: string): Promise<AiConfigResponse | null> {
    const config = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return null;
    }

    // encryptedApiKey is auto-decrypted by Prisma encryption middleware
    const settings = config.settings as Record<string, any>;

    return {
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      maskedApiKey: this.maskApiKey(config.encryptedApiKey),
      model: config.model,
      endpoint: settings?.endpoint,
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

    const data: any = {};

    if (dto.provider !== undefined) {
      data.provider = dto.provider;
    }
    if (dto.apiKey) {
      // Prisma encryption middleware will auto-encrypt on write
      data.encryptedApiKey = dto.apiKey;
    }
    if (dto.model !== undefined) {
      data.model = dto.model;
    }

    // Merge endpoint and other settings
    const mergedSettings: Record<string, any> = {
      ...(existing?.settings as Record<string, any>),
      ...dto.settings,
    };
    if (dto.endpoint !== undefined) {
      mergedSettings.endpoint = dto.endpoint;
    }
    data.settings = mergedSettings;

    let config;

    if (existing) {
      config = await this.prisma.aiConfig.update({
        where: { tenantId },
        data,
      });
    } else {
      // Create new config
      const provider = dto.provider || AIProviderType.ANTHROPIC;

      // Ollama doesn't require API key
      if (provider !== AIProviderType.OLLAMA && !dto.apiKey) {
        throw new BadRequestException(
          `API key is required for ${provider} provider`,
        );
      }

      config = await this.prisma.aiConfig.create({
        data: {
          tenantId,
          provider,
          encryptedApiKey: dto.apiKey || '',
          model: dto.model || this.getDefaultModel(provider),
          settings: mergedSettings,
        },
      });
    }

    const settings = config.settings as Record<string, any>;

    return {
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      maskedApiKey: this.maskApiKey(config.encryptedApiKey),
      model: config.model,
      endpoint: settings?.endpoint,
      settings,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private getDefaultModel(provider: AIProviderType): string {
    switch (provider) {
      case AIProviderType.OPENAI:
        return 'gpt-4o';
      case AIProviderType.ANTHROPIC:
        return 'claude-sonnet-4-6';
      case AIProviderType.OLLAMA:
        return 'llama3.1';
      default:
        return 'claude-sonnet-4-6';
    }
  }

  async validateKey(
    apiKey: string,
    provider?: AIProviderType,
    endpoint?: string,
    model?: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const providerType = provider || AIProviderType.ANTHROPIC;

      const config: AIProviderConfig = {
        provider: providerType as 'anthropic' | 'openai' | 'ollama',
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
    } catch (error: any) {
      this.logger.warn(`API key validation failed: ${error.message}`);

      if (error.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      if (error.status === 403) {
        return {
          valid: false,
          error: 'API key does not have required permissions',
        };
      }
      if (error.status === 429) {
        // Rate-limited but the key itself is valid
        return { valid: true };
      }

      return {
        valid: false,
        error: error.message || 'Failed to validate configuration',
      };
    }
  }

  async getDecryptedApiKey(tenantId: string): Promise<string | null> {
    const config = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return null;
    }

    // encryptedApiKey is auto-decrypted by Prisma encryption middleware
    return config.encryptedApiKey;
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return '****' + apiKey.slice(-4);
  }
}
