import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIProviderType } from './providers/ai-provider.interface';
import { AIProviderConfig, DEFAULT_MODELS } from './providers/ai-provider.types';

export type AITask =
  | 'classification'
  | 'vision'
  | 'enrichment'
  | 'investigation'
  | 'chat';

export interface ModelTier {
  task: AITask;
  provider: AIProviderType;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface TierResolution {
  providerConfig: AIProviderConfig;
  tier: ModelTier;
  reason: string;
}

/**
 * Default tier mappings — optimal model per AI task.
 *
 * Tier 1 (High quality):       Claude Sonnet → investigation, chat
 * Tier 2 (Good quality/price): Gemini Flash  → vision, enrichment
 * Tier 3 (Ultra-economic):     Claude Haiku  → classification
 */
export const DEFAULT_TIERS: Record<AITask, ModelTier> = {
  investigation: {
    task: 'investigation',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.3,
  },
  chat: {
    task: 'chat',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    temperature: 0.7,
  },
  vision: {
    task: 'vision',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    maxTokens: 2048,
    temperature: 0.3,
  },
  enrichment: {
    task: 'enrichment',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    maxTokens: 1500,
    temperature: 0.3,
  },
  classification: {
    task: 'classification',
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 100,
    temperature: 0.1,
  },
};

interface TenantAiState {
  provider: AIProviderType;
  apiKey: string;
  model: string;
  customTiers?: Record<string, Partial<ModelTier>>;
}

@Injectable()
export class ModelTieringService {
  private readonly logger = new Logger(ModelTieringService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve the optimal provider config for a given AI task.
   * Checks: custom tenant tiers → default tiers → fallback to tenant/system default.
   */
  async resolveForTask(
    task: AITask,
    tenantId?: string,
  ): Promise<TierResolution> {
    const tenantConfig = tenantId
      ? await this.getTenantConfig(tenantId)
      : null;

    const tier = this.getTierForTask(task, tenantConfig);

    // Try to get API key for the tier's preferred provider
    const apiKey = this.resolveApiKey(tier.provider, tenantConfig);

    if (apiKey) {
      const reason = tenantConfig?.customTiers?.[task]
        ? `custom tenant tier for ${task}`
        : `default tier for ${task}`;

      this.logger.log(
        `Task=${task} → ${tier.provider}/${tier.model} (${reason})`,
      );

      return {
        providerConfig: {
          provider: tier.provider,
          apiKey,
          model: tier.model,
        },
        tier,
        reason,
      };
    }

    // Fallback to tenant default or system default
    const fallback = this.resolveFallback(tier, tenantConfig);

    this.logger.log(
      `Task=${task} → ${fallback.providerConfig.provider}/${fallback.providerConfig.model} (${fallback.reason})`,
    );

    return fallback;
  }

  /**
   * Fetch tenant AI config and parse custom tiers from settings.
   */
  private async getTenantConfig(
    tenantId: string,
  ): Promise<TenantAiState | null> {
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { tenantId },
    });

    if (!aiConfig || !aiConfig.encryptedApiKey) return null;

    const settings = aiConfig.settings as Record<string, unknown>;

    return {
      provider: aiConfig.provider as AIProviderType,
      apiKey: aiConfig.encryptedApiKey,
      model: aiConfig.model,
      customTiers: settings?.tiers as
        | Record<string, Partial<ModelTier>>
        | undefined,
    };
  }

  /**
   * Get the tier for a task, merging custom tenant overrides with defaults.
   */
  private getTierForTask(
    task: AITask,
    tenantConfig: TenantAiState | null,
  ): ModelTier {
    const defaultTier = DEFAULT_TIERS[task];
    const customTier = tenantConfig?.customTiers?.[task];

    if (customTier) {
      return {
        task,
        provider:
          (customTier.provider as AIProviderType) || defaultTier.provider,
        model: customTier.model || defaultTier.model,
        maxTokens: customTier.maxTokens ?? defaultTier.maxTokens,
        temperature: customTier.temperature ?? defaultTier.temperature,
      };
    }

    return defaultTier;
  }

  /**
   * Try to get an API key for a specific provider.
   * Priority: tenant config (if same provider) → system env vars.
   */
  private resolveApiKey(
    provider: AIProviderType,
    tenantConfig: TenantAiState | null,
  ): string | undefined {
    // If tenant has this specific provider configured, use their key
    if (tenantConfig && tenantConfig.provider === provider) {
      return tenantConfig.apiKey;
    }

    // Check system env vars
    return this.getSystemApiKey(provider);
  }

  /**
   * Get API key from system environment variables.
   */
  getSystemApiKey(provider: AIProviderType): string | undefined {
    switch (provider) {
      case 'anthropic':
        return this.configService.get<string>('ANTHROPIC_API_KEY');
      case 'openai':
        return this.configService.get<string>('OPENAI_API_KEY');
      case 'gemini':
        return this.configService.get<string>('GOOGLE_AI_API_KEY');
      case 'bedrock':
        // Bedrock uses IAM credentials; if AWS_REGION is set, assume available
        return this.configService.get<string>('AWS_REGION')
          ? 'iam-credentials'
          : undefined;
      case 'ollama':
        // Ollama is local — always available
        return 'local';
      default:
        return undefined;
    }
  }

  /**
   * Fall back to tenant's default provider or system default.
   */
  private resolveFallback(
    tier: ModelTier,
    tenantConfig: TenantAiState | null,
  ): TierResolution {
    // Try tenant's default provider
    if (tenantConfig) {
      return {
        providerConfig: {
          provider: tenantConfig.provider,
          apiKey: tenantConfig.apiKey,
          model: tenantConfig.model,
        },
        tier: {
          ...tier,
          provider: tenantConfig.provider,
          model: tenantConfig.model,
        },
        reason: `fallback: ${tier.provider} unavailable, using tenant default (${tenantConfig.provider})`,
      };
    }

    // System-level fallback
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      return {
        providerConfig: {
          provider: 'anthropic',
          apiKey: anthropicKey,
          model: DEFAULT_MODELS.anthropic,
        },
        tier: {
          ...tier,
          provider: 'anthropic',
          model: DEFAULT_MODELS.anthropic,
        },
        reason: `fallback: ${tier.provider} unavailable, using system anthropic`,
      };
    }

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      return {
        providerConfig: {
          provider: 'openai',
          apiKey: openaiKey,
          model: DEFAULT_MODELS.openai,
        },
        tier: {
          ...tier,
          provider: 'openai',
          model: DEFAULT_MODELS.openai,
        },
        reason: `fallback: ${tier.provider} unavailable, using system openai`,
      };
    }

    throw new Error(
      `No AI provider available for task "${tier.task}". Configure at least one AI provider.`,
    );
  }
}
