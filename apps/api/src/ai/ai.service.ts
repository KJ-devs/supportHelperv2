import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIProvider } from './providers/ai-provider.interface';
import { AIProviderFactory } from './providers/ai-provider.factory';
import { AIProviderConfig, DEFAULT_MODELS } from './providers/ai-provider.types';

export interface VideoAnalysisResult {
  summary: string;
  severity: string;
  severityConfidence: number;
  type: string;
  typeConfidence: number;
  keywords: string[];
  reproductionSteps: string[];
}

const _EMBEDDING_BATCH_SIZE = 100;
const _EMBEDDING_MAX_CHARS = 32000; // ~8191 tokens * ~4 chars/token

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private provider: AIProvider | null = null;
  private providerConfig: AIProviderConfig | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private providerFactory: AIProviderFactory,
  ) {}

  /**
   * Initialize or recreate provider based on current config
   */
  private async initializeProvider(tenantId?: string): Promise<void> {
    const config = await this.getProviderConfig(tenantId);

    // Only recreate if config changed
    const configKey = JSON.stringify(config);
    const currentKey = this.providerConfig ? JSON.stringify(this.providerConfig) : null;

    if (configKey !== currentKey) {
      this.providerConfig = config;
      this.provider = config ? this.providerFactory.create(config) : null;
    }
  }

  /**
   * Get provider config from SystemConfig or env vars (fallback)
   */
  async getProviderConfig(tenantId?: string): Promise<AIProviderConfig | null> {
    // Try to get per-tenant config first (if tenantId provided)
    if (tenantId) {
      try {
        const aiConfig = await this.prisma.aiConfig.findUnique({
          where: { tenantId },
        });

        if (aiConfig) {
          return {
            provider: aiConfig.provider as 'anthropic' | 'openai' | 'ollama',
            apiKey: aiConfig.encryptedApiKey, // Auto-decrypted by Prisma middleware
            model: aiConfig.model,
          };
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch tenant AI config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    // Fall back to system-wide config from env vars (Anthropic preferred, OpenAI as fallback)
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      return {
        provider: 'anthropic',
        apiKey: anthropicKey,
        model: DEFAULT_MODELS.anthropic,
      };
    }

    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      return {
        provider: 'openai',
        apiKey: openaiKey,
        model: DEFAULT_MODELS.openai,
      };
    }

    // No config available
    return null;
  }

  /**
   * Get the active AI provider instance
   */
  async getActiveProvider(tenantId?: string): Promise<AIProvider | null> {
    await this.initializeProvider(tenantId);
    return this.provider;
  }

  /**
   * Update provider config (system-wide, stored in SystemConfig)
   */
  async updateProviderConfig(config: AIProviderConfig): Promise<void> {
    await this.prisma.systemConfig.upsert({
      where: { key: 'ai_config' },
      create: {
        key: 'ai_config',
        value: config,
      },
      update: {
        value: config,
      },
    });

    // Invalidate cached provider
    this.provider = null;
    this.providerConfig = null;
  }

  /**
   * Test connection to configured provider
   */
  async testConnection(tenantId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const provider = await this.getActiveProvider(tenantId);

      if (!provider) {
        return {
          success: false,
          message: 'No AI provider configured',
        };
      }

      const isValid = await provider.validateConfig();

      return {
        success: isValid,
        message: isValid
          ? `Successfully connected to ${provider.getProviderName()}`
          : `Failed to connect to ${provider.getProviderName()}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate embedding for a single text input.
   * Uses provider's embedding capability if available.
   */
  async generateEmbedding(text: string, tenantId?: string): Promise<number[]> {
    const provider = await this.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider configured, cannot generate embedding');
      return [];
    }

    if (!provider.generateEmbedding) {
      this.logger.warn(
        `Provider ${provider.getProviderName()} does not support embeddings`,
      );
      return [];
    }

    try {
      return await provider.generateEmbedding(text);
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Generate embeddings for multiple texts.
   * Processes sequentially if provider doesn't support batch.
   */
  async generateEmbeddings(texts: string[], tenantId?: string): Promise<number[][]> {
    const provider = await this.getActiveProvider(tenantId);

    if (!provider || !provider.generateEmbedding) {
      this.logger.warn('No embedding-capable AI provider configured');
      return texts.map(() => []);
    }

    const results: number[][] = [];

    // Process sequentially (providers may have their own batching)
    for (const text of texts) {
      try {
        const embedding = await provider.generateEmbedding(text);
        results.push(embedding);
      } catch (error) {
        this.logger.error(
          `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        results.push([]);
      }
    }

    return results;
  }

  async analyzeVideoTranscript(
    transcript: string,
    ocrText?: string,
    tenantId?: string,
  ): Promise<VideoAnalysisResult> {
    const provider = await this.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider configured, returning mock analysis');
      return this.getMockAnalysis(transcript);
    }

    try {
      const prompt = `
Analyze the following technical support issue based on the user's description and any OCR text from screenshots.

User Description:
${transcript}

${ocrText ? `OCR Text from Screenshots:\n${ocrText}` : ''}

Please provide a JSON response with the following fields:
- summary: A brief 1-2 sentence summary of the issue
- severity: One of 'low', 'medium', 'high', 'critical'
- severityConfidence: A number between 0 and 1
- type: The issue type: 'bug', 'performance', 'feature_request', 'question', 'security', or 'documentation'
- typeConfidence: A number between 0 and 1
- keywords: An array of relevant keywords
- reproductionSteps: An array of steps to reproduce the issue if mentioned

Respond ONLY with valid JSON.
      `;

      const schema = {
        summary: 'string',
        severity: 'string',
        severityConfidence: 'number',
        type: 'string',
        typeConfidence: 'number',
        keywords: 'array',
        reproductionSteps: 'array',
      };

      const analysis = await provider.generateStructuredOutput<Record<string, unknown>>(prompt, schema, {
        systemPrompt:
          'You are a technical support AI that analyzes bug reports and technical issues. Always respond with valid JSON.',
        temperature: 0.3,
        maxTokens: 1000,
      });

      return {
        summary: (analysis.summary as string) || 'Unable to generate summary',
        severity: (analysis.severity as string) || 'medium',
        severityConfidence: (analysis.severityConfidence as number) || 0.5,
        type: (analysis.type as string) || 'other',
        typeConfidence: (analysis.typeConfidence as number) || 0.5,
        keywords: (analysis.keywords as string[]) || [],
        reproductionSteps: (analysis.reproductionSteps as string[]) || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Return mock analysis on error for MVP
      return this.getMockAnalysis(transcript);
    }
  }

  /**
   * Process user bug description: reformulate, categorize, enrich with technical context
   */
  async processUserDescription(
    description: string,
    userContext?: Record<string, unknown>,
    tenantId?: string,
  ): Promise<VideoAnalysisResult & { enrichedDescription: string }> {
    const provider = await this.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider configured, returning basic processing');
      const mock = this.getMockAnalysis(description);
      return {
        ...mock,
        enrichedDescription: description,
      };
    }

    try {
      const contextInfo = userContext
        ? `\n\nTechnical Context:\n- OS/Platform: ${userContext.os || 'Unknown'}\n- Browser: ${userContext.browser || 'Unknown'}\n- Viewport: ${userContext.viewport || 'Unknown'}\n- URL: ${userContext.url || 'Unknown'}\n- Timestamp: ${userContext.timestamp || 'Unknown'}`
        : '';

      const prompt = `
You are a technical support AI assistant. A user has submitted a bug report with the following description and technical context.

User Description:
${description}
${contextInfo}

Please provide a JSON response with the following fields:
- enrichedDescription: A clear, professional reformulation of the user's description, enriched with the technical context. Keep the user's intent but make it clearer and more actionable for a developer.
- summary: A brief 1-2 sentence summary of the issue
- severity: One of 'low', 'medium', 'high', 'critical'
- severityConfidence: A number between 0 and 1
- type: The issue type: 'bug', 'performance', 'feature_request', 'question', 'security', or 'documentation'
- typeConfidence: A number between 0 and 1
- keywords: An array of relevant keywords for search and categorization
- reproductionSteps: An array of inferred steps to reproduce the issue based on the description

Respond ONLY with valid JSON.
      `;

      const schema = {
        enrichedDescription: 'string',
        summary: 'string',
        severity: 'string',
        severityConfidence: 'number',
        type: 'string',
        typeConfidence: 'number',
        keywords: 'array',
        reproductionSteps: 'array',
      };

      const analysis = await provider.generateStructuredOutput<Record<string, unknown>>(prompt, schema, {
        systemPrompt:
          'You are a technical support AI that processes and enriches bug reports. Always respond with valid JSON.',
        temperature: 0.3,
        maxTokens: 1500,
      });

      return {
        enrichedDescription: (analysis.enrichedDescription as string) || description,
        summary: (analysis.summary as string) || 'Unable to generate summary',
        severity: (analysis.severity as string) || 'medium',
        severityConfidence: (analysis.severityConfidence as number) || 0.5,
        type: (analysis.type as string) || 'other',
        typeConfidence: (analysis.typeConfidence as number) || 0.5,
        keywords: (analysis.keywords as string[]) || [],
        reproductionSteps: (analysis.reproductionSteps as string[]) || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to process description: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      const mock = this.getMockAnalysis(description);
      return {
        ...mock,
        enrichedDescription: description,
      };
    }
  }

  async classifyIssue(description: string, tenantId?: string): Promise<string> {
    const provider = await this.getActiveProvider(tenantId);

    if (!provider) {
      return 'other';
    }

    try {
      const response = await provider.generateCompletion(
        `Classify this issue: ${description}`,
        {
          systemPrompt:
            'You are a technical support AI classifier. Classify the issue into one category only: crash, performance, ui, data-loss, feature-request, or other.',
          maxTokens: 20,
          temperature: 0.1,
        },
      );

      const content = response.toLowerCase();
      const validTypes = ['crash', 'performance', 'ui', 'data-loss', 'feature-request', 'other'];
      return validTypes.find((t) => content.includes(t)) || 'other';
    } catch (error) {
      this.logger.error(`Classification failed: ${error}`);
      return 'other';
    }
  }

  async generateCompletion(prompt: string, tenantId?: string): Promise<string> {
    const provider = await this.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider configured, returning empty response');
      return '';
    }

    try {
      return await provider.generateCompletion(prompt, {
        systemPrompt: 'You are a helpful technical support AI assistant.',
        temperature: 0.7,
        maxTokens: 1500,
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate completion: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return '';
    }
  }

  private getMockAnalysis(transcript: string): VideoAnalysisResult {
    return {
      summary: transcript.substring(0, 100) + (transcript.length > 100 ? '...' : ''),
      severity: 'medium',
      severityConfidence: 0.6,
      type: 'other',
      typeConfidence: 0.4,
      keywords: ['issue', 'problem'],
      reproductionSteps: ['Steps to reproduce not provided'],
    };
  }
}
