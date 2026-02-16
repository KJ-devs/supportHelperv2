import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  settings: Record<string, any>;
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

    return {
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      maskedApiKey: this.maskApiKey(
        this.encryptionService.decrypt(config.encryptedApiKey),
      ),
      model: config.model,
      settings: config.settings as Record<string, any>,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async upsertConfig(
    tenantId: string,
    dto: UpdateAiConfigDto,
  ): Promise<AiConfigResponse> {
    const data: any = {};

    if (dto.apiKey) {
      data.encryptedApiKey = this.encryptionService.encrypt(dto.apiKey);
    }
    if (dto.model !== undefined) {
      data.model = dto.model;
    }
    if (dto.settings !== undefined) {
      data.settings = dto.settings;
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
      if (!dto.apiKey) {
        throw new BadRequestException(
          'API key is required when creating a new AI configuration',
        );
      }
      config = await this.prisma.aiConfig.create({
        data: {
          tenantId,
          encryptedApiKey: data.encryptedApiKey,
          model: dto.model || 'claude-sonnet-4-20250514',
          settings: dto.settings || {},
        },
      });
    }

    return {
      id: config.id,
      tenantId: config.tenantId,
      provider: config.provider,
      maskedApiKey: this.maskApiKey(
        this.encryptionService.decrypt(config.encryptedApiKey),
      ),
      model: config.model,
      settings: config.settings as Record<string, any>,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async validateKey(
    apiKey: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = new Anthropic({ apiKey });

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
        return { valid: false, error: 'API key does not have required permissions' };
      }
      if (error.status === 429) {
        // Rate-limited but the key itself is valid
        return { valid: true };
      }

      return {
        valid: false,
        error: error.message || 'Failed to validate API key',
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

    return this.encryptionService.decrypt(config.encryptedApiKey);
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****';
    }
    return '****' + apiKey.slice(-4);
  }
}
