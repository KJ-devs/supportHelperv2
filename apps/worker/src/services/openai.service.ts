import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { createDecipheriv } from 'crypto';
import { PrismaService } from './prisma.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

// ═══════════════════════════════════════════════════════════════════════
// TENANT AI CONFIG CACHE
// ═══════════════════════════════════════════════════════════════════════

interface TenantAiConfig {
  provider: string;
  apiKey: string;
  model: string;
  resolvedAt: number; // timestamp for TTL
}

const TENANT_CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Decrypt a value stored in AES-256-GCM format: iv:authTag:ciphertext (base64-encoded).
 * Matches the logic in apps/api/src/common/services/encryption.service.ts.
 * Key source: ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 */
function decryptAiKey(encryptedPayload: string, keyHex: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected iv:authTag:ciphertext');
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Check if a value is in the encrypted iv:authTag:ciphertext format.
 * Plain-text (unencrypted) keys are used as-is.
 */
function isEncryptedPayload(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every(part => part.length > 0 && base64Regex.test(part));
}

// ═══════════════════════════════════════════════════════════════════════
// INTERFACES & TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface VideoAnalysis {
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'bug' | 'feature' | 'ui' | 'performance' | 'security';
  reproSteps: string[];
  component: string;
  uiElements: string[];
  errorMessages: string[];
  confidence: {
    overall: number;
    severity: number;
    type: number;
    component: number;
  };
}

export interface Classification {
  type: 'bug' | 'feature' | 'ui' | 'performance' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  keywords: string[];
  confidence: {
    type: number;
    severity: number;
  };
}

export interface EmbeddingResult {
  embedding: number[];
  text: string;
  dimensions: number;
  cached: boolean;
}

export interface SimilarTicket {
  id: string;
  title: string;
  description: string;
  similarity: number;
  type: string;
  severity: string;
  status: string;
}

export interface CostTracking {
  tenantId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

export interface RateLimitState {
  requestCount: number;
  windowStart: number;
}

// ═══════════════════════════════════════════════════════════════════════
// OPENAI SERVICE (now powered by Anthropic for completions/vision)
// ═══════════════════════════════════════════════════════════════════════

/**
 * AI Service
 *
 * Comprehensive AI operations with:
 * - Claude Sonnet 4.5 Vision multi-frame analysis
 * - Claude Haiku 4.5 fast classification
 * - OpenAI text-embedding-3-large (3072 dimensions) - optional
 * - Redis caching (24h TTL)
 * - Rate limiting (50 req/min)
 * - Cost tracking per tenant
 * - pgvector similarity search
 */
@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly anthropicClient: Anthropic;
  private readonly openaiClient: OpenAI | null;
  private readonly anthropicConfig: any;
  private readonly openaiConfig: any;
  private redis!: Redis;

  // Rate limiting
  private readonly RATE_LIMIT = 50; // requests per minute
  private readonly RATE_WINDOW = 60000; // 1 minute in ms
  private rateLimitState: Map<string, RateLimitState> = new Map();

  // Per-tenant AI config cache (5-minute TTL)
  private readonly tenantConfigCache: Map<string, TenantAiConfig> = new Map();

  // Cache settings
  private readonly EMBEDDING_CACHE_TTL = 86400; // 24 hours in seconds
  private readonly EMBEDDING_CACHE_PREFIX = 'openai:embedding:';

  // Cost per 1K tokens (approximate)
  private readonly MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.anthropicConfig = this.configService.get('anthropic');
    this.openaiConfig = this.configService.get('openai');

    this.anthropicClient = new Anthropic({
      apiKey: this.anthropicConfig?.apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // OpenAI is optional - only used for embeddings
    const openaiApiKey = this.openaiConfig?.apiKey || process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    } else {
      this.openaiClient = null;
      this.logger.warn('OpenAI API key not set - embeddings will return empty vectors');
    }
  }

  async onModuleInit() {
    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.logger.log('AI Service initialized (Anthropic for completions, OpenAI for embeddings)');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIDEO ANALYSIS (Claude Sonnet 4.5 Vision)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyze video frames with Claude Sonnet 4.5 Vision
   * Multi-frame analysis for comprehensive bug understanding
   */
  async analyzeVideo(
    frames: Buffer[],
    tenantId: string,
    context?: { ocrText?: string; uiDetections?: any[] }
  ): Promise<VideoAnalysis> {
    // Check rate limit
    await this.checkRateLimit(tenantId);

    // Determine which provider to use for this tenant
    const tenantConfig = await this.resolveTenantConfig(tenantId);
    const useOpenAI =
      tenantConfig?.provider === 'openai' ||
      (!tenantConfig && !process.env.ANTHROPIC_API_KEY && !!this.openaiClient);

    if (useOpenAI) {
      return this.analyzeVideoWithOpenAI(frames, tenantId, tenantConfig, context);
    }
    return this.analyzeVideoWithAnthropic(frames, tenantId, context);
  }

  private async analyzeVideoWithAnthropic(
    frames: Buffer[],
    tenantId: string,
    context?: { ocrText?: string; uiDetections?: any[] }
  ): Promise<VideoAnalysis> {
    // Resolve tenant-specific client and model
    const { client, visionModel: model } = await this.getAnthropicClientForTenant(tenantId);
    this.logger.log(`Analyzing ${frames.length} frames with Anthropic ${model}`);

    try {
      // Convert frames to base64 (max 10 frames for efficiency)
      const selectedFrames = this.selectKeyFrames(frames, 10);
      const imageContents: Anthropic.ImageBlockParam[] = selectedFrames.map(buffer => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/png' as const,
          data: buffer.toString('base64'),
        },
      }));

      const systemPrompt = this.buildVideoAnalysisPrompt(context);

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze these video frames from a bug report:' },
              ...imageContents,
            ],
          },
        ],
      });

      // Track costs
      await this.trackCost(tenantId, model, {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      if (!content) {
        throw new Error('No response from Claude Vision');
      }

      const parsed = JSON.parse(this.extractJson(content));
      return this.normalizeVideoAnalysis(parsed);
    } catch (error) {
      this.logger.error(`Video analysis failed (Anthropic): ${getErrorMessage(error)}`, getErrorStack(error));
      return this.getFallbackVideoAnalysis();
    }
  }

  private async analyzeVideoWithOpenAI(
    frames: Buffer[],
    tenantId: string,
    tenantConfig: TenantAiConfig | null,
    context?: { ocrText?: string; uiDetections?: any[] }
  ): Promise<VideoAnalysis> {
    // Resolve the OpenAI client to use — tenant key if provided, otherwise shared client
    let openaiClient: OpenAI;
    if (tenantConfig?.provider === 'openai' && tenantConfig.apiKey) {
      openaiClient = new OpenAI({ apiKey: tenantConfig.apiKey });
    } else if (this.openaiClient) {
      openaiClient = this.openaiClient;
    } else {
      this.logger.warn('OpenAI client not available for video analysis — falling back to Anthropic');
      return this.analyzeVideoWithAnthropic(frames, tenantId, context);
    }

    const model = tenantConfig?.provider === 'openai' && tenantConfig.model
      ? tenantConfig.model
      : 'gpt-4o';

    this.logger.log(`Analyzing ${frames.length} frames with OpenAI ${model}`);

    try {
      const selectedFrames = this.selectKeyFrames(frames, 10);
      const systemPrompt = this.buildVideoAnalysisPrompt(context);

      // Build image_url content blocks for OpenAI vision
      const imageBlocks: OpenAI.Chat.ChatCompletionContentPartImage[] = selectedFrames.map(buffer => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/png;base64,${buffer.toString('base64')}`,
          detail: 'low' as const,
        },
      }));

      const response = await openaiClient.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze these video frames from a bug report:' },
              ...imageBlocks,
            ],
          },
        ],
      });

      // Track costs
      await this.trackCost(tenantId, model, {
        prompt_tokens: response.usage?.prompt_tokens,
        completion_tokens: response.usage?.completion_tokens,
        total_tokens: response.usage?.total_tokens,
      });

      const content = response.choices[0]?.message?.content ?? '';
      if (!content) {
        throw new Error('No response from OpenAI Vision');
      }

      const parsed = JSON.parse(this.extractJson(content));
      return this.normalizeVideoAnalysis(parsed);
    } catch (error) {
      this.logger.error(`Video analysis failed (OpenAI): ${getErrorMessage(error)}`, getErrorStack(error));
      return this.getFallbackVideoAnalysis();
    }
  }

  private buildVideoAnalysisPrompt(context?: { ocrText?: string; uiDetections?: any[] }): string {
    let prompt = `You are an expert UI/UX analyst and bug triage specialist analyzing video frames from a bug report.

Analyze the sequence of screenshots and extract:
1. **Summary**: Concise description of the issue (2-3 sentences)
2. **Severity**: critical (app crash/data loss), high (major feature broken), medium (minor bug), low (cosmetic)
3. **Type**: bug (error/crash), feature (missing functionality), ui (visual issue), performance (slow/laggy), security (vulnerability)
4. **Reproduction Steps**: Numbered list of steps to reproduce the issue
5. **Component**: The main UI component or page affected
6. **UI Elements**: List of visible UI elements (buttons, forms, etc.)
7. **Error Messages**: Any visible error text or warnings

Provide confidence scores (0-1) for your classifications.`;

    if (context?.ocrText) {
      prompt += `\n\nExtracted OCR text: ${context.ocrText.substring(0, 2000)}`;
    }
    if (context?.uiDetections?.length) {
      prompt += `\n\nDetected UI elements: ${JSON.stringify(context.uiDetections.slice(0, 20))}`;
    }

    prompt += `\n\nRespond ONLY with valid JSON (no markdown, no code blocks):
{
  "summary": "string",
  "severity": "critical|high|medium|low",
  "type": "bug|feature|ui|performance|security",
  "reproSteps": ["step1", "step2", ...],
  "component": "string",
  "uiElements": ["element1", "element2", ...],
  "errorMessages": ["error1", "error2", ...],
  "confidence": { "overall": 0.0-1.0, "severity": 0.0-1.0, "type": 0.0-1.0, "component": 0.0-1.0 }
}`;

    return prompt;
  }

  private selectKeyFrames(frames: Buffer[], maxFrames: number): Buffer[] {
    if (frames.length <= maxFrames) return frames;

    // Select evenly distributed frames
    const step = Math.floor(frames.length / maxFrames);
    const selected: Buffer[] = [];

    for (let i = 0; i < frames.length && selected.length < maxFrames; i += step) {
      const frame = frames[i];
      if (frame) {
        selected.push(frame);
      }
    }

    return selected;
  }

  private normalizeVideoAnalysis(parsed: any): VideoAnalysis {
    return {
      summary: parsed.summary || 'Unable to analyze video content',
      severity: this.normalizeSeverity(parsed.severity),
      type: this.normalizeType(parsed.type),
      reproSteps: Array.isArray(parsed.reproSteps) ? parsed.reproSteps : [],
      component: parsed.component || 'unknown',
      uiElements: Array.isArray(parsed.uiElements) ? parsed.uiElements : [],
      errorMessages: Array.isArray(parsed.errorMessages) ? parsed.errorMessages : [],
      confidence: {
        overall: parsed.confidence?.overall ?? 0.5,
        severity: parsed.confidence?.severity ?? 0.5,
        type: parsed.confidence?.type ?? 0.5,
        component: parsed.confidence?.component ?? 0.5,
      },
    };
  }

  private getFallbackVideoAnalysis(): VideoAnalysis {
    return {
      summary: 'Video analysis unavailable - API error',
      severity: 'medium',
      type: 'bug',
      reproSteps: [],
      component: 'unknown',
      uiElements: [],
      errorMessages: [],
      confidence: { overall: 0, severity: 0, type: 0, component: 0 },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TICKET CLASSIFICATION (Claude Haiku 4.5)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fast ticket classification.
   * Uses gpt-4o-mini when the tenant's configured provider is 'openai',
   * otherwise uses Claude Haiku (Anthropic).
   */
  async classifyTicket(text: string, tenantId: string): Promise<Classification> {
    this.logger.debug(`Classifying ticket (${text.length} chars)`);

    // Check rate limit
    await this.checkRateLimit(tenantId);

    // Determine provider for this tenant
    const tenantConfig = await this.resolveTenantConfig(tenantId);
    const useOpenAI =
      tenantConfig?.provider === 'openai' ||
      (!tenantConfig && !process.env.ANTHROPIC_API_KEY && !!this.openaiClient);

    if (useOpenAI) {
      return this.classifyTicketWithOpenAI(text, tenantId, tenantConfig);
    }
    return this.classifyTicketWithAnthropic(text, tenantId);
  }

  private readonly CLASSIFICATION_SYSTEM_PROMPT = `You are a bug triage expert. Classify the following support ticket/bug report.

Classify into:
- Type: bug (error/crash), feature (missing functionality), ui (visual issue), performance (slow/laggy), security (vulnerability)
- Severity: critical (app crash/data loss), high (major feature broken), medium (minor bug), low (cosmetic)
- Keywords: Extract 3-7 relevant technical keywords

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "type": "bug|feature|ui|performance|security",
  "severity": "critical|high|medium|low",
  "keywords": ["keyword1", "keyword2", ...],
  "confidence": { "type": 0.0-1.0, "severity": 0.0-1.0 }
}`;

  private async classifyTicketWithAnthropic(text: string, tenantId: string): Promise<Classification> {
    const { client, chatFastModel: model } = await this.getAnthropicClientForTenant(tenantId);

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 500,
        system: this.CLASSIFICATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: text.substring(0, 4000),
          },
        ],
      });

      // Track costs
      await this.trackCost(tenantId, model, {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      if (!content) {
        throw new Error('No response from Claude');
      }

      const parsed = JSON.parse(this.extractJson(content));
      return this.normalizeClassification(parsed);
    } catch (error) {
      this.logger.error(`Classification failed (Anthropic): ${getErrorMessage(error)}`);
      return this.getFallbackClassification();
    }
  }

  private async classifyTicketWithOpenAI(
    text: string,
    tenantId: string,
    tenantConfig: TenantAiConfig | null
  ): Promise<Classification> {
    // Resolve the OpenAI client — tenant key if available, otherwise shared
    let openaiClient: OpenAI;
    if (tenantConfig?.provider === 'openai' && tenantConfig.apiKey) {
      openaiClient = new OpenAI({ apiKey: tenantConfig.apiKey });
    } else if (this.openaiClient) {
      openaiClient = this.openaiClient;
    } else {
      this.logger.warn('OpenAI client not available for classification — falling back to Anthropic');
      return this.classifyTicketWithAnthropic(text, tenantId);
    }

    // Use gpt-4o-mini for cost-efficient classification
    const model = 'gpt-4o-mini';
    this.logger.debug(`Classifying ticket with OpenAI ${model}`);

    try {
      const response = await openaiClient.chat.completions.create({
        model,
        max_tokens: 500,
        messages: [
          { role: 'system', content: this.CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: text.substring(0, 4000) },
        ],
      });

      // Track costs
      await this.trackCost(tenantId, model, {
        prompt_tokens: response.usage?.prompt_tokens,
        completion_tokens: response.usage?.completion_tokens,
        total_tokens: response.usage?.total_tokens,
      });

      const content = response.choices[0]?.message?.content ?? '';
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(this.extractJson(content));
      return this.normalizeClassification(parsed);
    } catch (error) {
      this.logger.error(`Classification failed (OpenAI): ${getErrorMessage(error)}`);
      return this.getFallbackClassification();
    }
  }

  private normalizeClassification(parsed: any): Classification {
    return {
      type: this.normalizeType(parsed.type),
      severity: this.normalizeSeverity(parsed.severity),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
      confidence: {
        type: parsed.confidence?.type ?? 0.5,
        severity: parsed.confidence?.severity ?? 0.5,
      },
    };
  }

  private getFallbackClassification(): Classification {
    return {
      type: 'bug',
      severity: 'medium',
      keywords: [],
      confidence: { type: 0, severity: 0 },
    };
  }

  private normalizeSeverity(value: string): 'critical' | 'high' | 'medium' | 'low' {
    const normalized = value?.toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
      return normalized as 'critical' | 'high' | 'medium' | 'low';
    }
    return 'medium';
  }

  private normalizeType(value: string): 'bug' | 'feature' | 'ui' | 'performance' | 'security' {
    const normalized = value?.toLowerCase();
    if (['bug', 'feature', 'ui', 'performance', 'security'].includes(normalized)) {
      return normalized as 'bug' | 'feature' | 'ui' | 'performance' | 'security';
    }
    return 'bug';
  }

  /**
   * Extract JSON from text response (handles markdown code blocks)
   */
  private extractJson(text: string): string {
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch?.[1]) {
      return codeBlockMatch[1].trim();
    }

    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    // Return as-is, let JSON.parse handle it
    return text;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EMBEDDINGS (text-embedding-3-large via OpenAI - optional)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate embedding with Redis caching (24h TTL)
   * Falls back to empty embedding if OpenAI is not configured
   */
  async generateEmbedding(text: string, tenantId?: string): Promise<EmbeddingResult> {
    this.logger.debug(`Generating embedding (${text.length} chars)`);

    // Generate cache key from text hash
    const textHash = this.hashText(text);
    const cacheKey = `${this.EMBEDDING_CACHE_PREFIX}${textHash}`;

    // Check Redis cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug('Embedding cache hit');
        const embedding = JSON.parse(cached);
        return {
          embedding,
          text,
          dimensions: embedding.length,
          cached: true,
        };
      }
    } catch (error) {
      this.logger.warn(`Redis cache read error: ${getErrorMessage(error)}`);
    }

    // Gracefully fail if no OpenAI client
    if (!this.openaiClient) {
      this.logger.warn('OpenAI not configured - returning empty embedding');
      return {
        embedding: [],
        text,
        dimensions: 0,
        cached: false,
      };
    }

    // Rate limit check
    if (tenantId) {
      await this.checkRateLimit(tenantId);
    }

    try {
      // Truncate text if too long (max ~8000 tokens)
      const truncated = text.substring(0, 32000);

      const response = await this.openaiClient.embeddings.create({
        model: 'text-embedding-3-large',
        input: truncated,
        dimensions: 3072, // Full dimensions for best quality
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        throw new Error('Failed to generate embedding');
      }

      // Track costs
      if (tenantId && response.usage) {
        await this.trackCost(tenantId, 'text-embedding-3-large', {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: 0,
          total_tokens: response.usage.total_tokens,
        });
      }

      // Cache in Redis (24h TTL)
      try {
        await this.redis.setex(cacheKey, this.EMBEDDING_CACHE_TTL, JSON.stringify(embedding));
        this.logger.debug('Embedding cached successfully');
      } catch (error) {
        this.logger.warn(`Redis cache write error: ${getErrorMessage(error)}`);
      }

      return {
        embedding,
        text: truncated,
        dimensions: embedding.length,
        cached: false,
      };
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 32);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SIMILARITY SEARCH (pgvector)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Search similar tickets using pgvector cosine similarity
   * Uses HNSW index for efficient search
   */
  async searchSimilarTickets(
    embedding: number[],
    limit: number = 10,
    tenantId?: string,
    excludeTicketId?: string
  ): Promise<SimilarTicket[]> {
    this.logger.debug(`Searching similar tickets (limit: ${limit})`);

    try {
      // Build the pgvector query with cosine similarity
      const embeddingStr = `[${embedding.join(',')}]`;

      let query = `
        SELECT
          id,
          title,
          description,
          type,
          severity,
          status,
          1 - (embedding <=> $1::vector) as similarity
        FROM tickets
        WHERE embedding IS NOT NULL
      `;

      const params: (string | number)[] = [embeddingStr];
      let paramIndex = 2;

      if (tenantId) {
        query += ` AND tenant_id = $${paramIndex}::uuid`;
        params.push(tenantId);
        paramIndex++;
      }

      if (excludeTicketId) {
        query += ` AND id != $${paramIndex}::uuid`;
        params.push(excludeTicketId);
        paramIndex++;
      }

      query += `
        ORDER BY embedding <=> $1::vector
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as Array<{
        id: string;
        title: string | null;
        description: string | null;
        type: string | null;
        severity: string | null;
        status: string | null;
        similarity: number;
      }>;

      return results.map(row => ({
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        similarity: parseFloat(String(row.similarity)) || 0,
        type: row.type || 'bug',
        severity: row.severity || 'medium',
        status: row.status || 'new',
      }));
    } catch (error) {
      this.logger.error(`Similarity search failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Store embedding for a ticket
   */
  async storeTicketEmbedding(ticketId: string, embedding: number[]): Promise<void> {
    try {
      const embeddingStr = `[${embedding.join(',')}]`;
      await this.prisma.$executeRawUnsafe(
        `UPDATE tickets SET embedding = $1::vector WHERE id = $2::uuid`,
        embeddingStr,
        ticketId
      );
      this.logger.debug(`Stored embedding for ticket ${ticketId}`);
    } catch (error) {
      this.logger.error(`Failed to store embedding: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TENANT AI CONFIG RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Resolve the AI configuration for a tenant.
   *
   * Resolution order:
   * 1. In-memory cache (5-minute TTL)
   * 2. Database AiConfig row for the tenant (decrypted with ENCRYPTION_KEY)
   * 3. Environment variable fallback (ANTHROPIC_API_KEY / OPENAI_API_KEY)
   *
   * The worker's PrismaService does not include the encryption middleware that
   * the API uses, so we decrypt the encryptedApiKey manually here using the
   * same AES-256-GCM algorithm as apps/api/src/common/services/encryption.service.ts.
   */
  private async resolveTenantConfig(tenantId: string): Promise<TenantAiConfig | null> {
    // 1. Check in-memory cache
    const cached = this.tenantConfigCache.get(tenantId);
    if (cached && Date.now() - cached.resolvedAt < TENANT_CONFIG_TTL_MS) {
      return cached;
    }

    // 2. Query the database
    try {
      const dbConfig = await this.prisma.aiConfig.findUnique({
        where: { tenantId },
        select: { provider: true, encryptedApiKey: true, model: true },
      });

      if (dbConfig && dbConfig.encryptedApiKey) {
        let apiKey: string;

        // Decrypt only if the stored value is in the encrypted format.
        // A plain-text key (e.g. stored without encryption in dev) is used as-is.
        if (isEncryptedPayload(dbConfig.encryptedApiKey)) {
          const encryptionKeyHex = process.env.ENCRYPTION_KEY;
          if (!encryptionKeyHex) {
            this.logger.warn(
              `ENCRYPTION_KEY not set — cannot decrypt tenant ${tenantId} AI key. Falling back to env vars.`
            );
            return null;
          }
          try {
            apiKey = decryptAiKey(dbConfig.encryptedApiKey, encryptionKeyHex);
          } catch (decryptError) {
            this.logger.warn(
              `Failed to decrypt AI key for tenant ${tenantId}: ${getErrorMessage(decryptError)}. Falling back to env vars.`
            );
            return null;
          }
        } else {
          apiKey = dbConfig.encryptedApiKey;
        }

        const resolved: TenantAiConfig = {
          provider: dbConfig.provider,
          apiKey,
          model: dbConfig.model,
          resolvedAt: Date.now(),
        };

        this.tenantConfigCache.set(tenantId, resolved);
        this.logger.debug(
          `Resolved tenant ${tenantId} AI config: provider=${resolved.provider} model=${resolved.model}`
        );
        return resolved;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to query AI config for tenant ${tenantId}: ${getErrorMessage(error)}. Falling back to env vars.`
      );
    }

    // 3. No tenant config found — caller will use env var fallback
    return null;
  }

  /**
   * Build an Anthropic client for a tenant, falling back to the shared instance
   * when no per-tenant config exists.
   */
  private async getAnthropicClientForTenant(tenantId: string): Promise<{
    client: Anthropic;
    visionModel: string;
    chatModel: string;
    chatFastModel: string;
  }> {
    const tenantConfig = await this.resolveTenantConfig(tenantId);

    if (tenantConfig && tenantConfig.provider === 'anthropic' && tenantConfig.apiKey) {
      return {
        client: new Anthropic({ apiKey: tenantConfig.apiKey }),
        visionModel: tenantConfig.model,
        chatModel: tenantConfig.model,
        chatFastModel: tenantConfig.model,
      };
    }

    // Fallback to shared client + env-based model config
    return {
      client: this.anthropicClient,
      visionModel: this.anthropicConfig?.models?.vision || 'claude-sonnet-4-6',
      chatModel: this.anthropicConfig?.models?.chat || 'claude-sonnet-4-6',
      chatFastModel: this.anthropicConfig?.models?.chatFast || 'claude-haiku-4-5-20251001',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════════════════════

  private async checkRateLimit(tenantId: string): Promise<void> {
    const now = Date.now();
    const state = this.rateLimitState.get(tenantId) || { requestCount: 0, windowStart: now };

    // Reset window if expired
    if (now - state.windowStart >= this.RATE_WINDOW) {
      state.requestCount = 0;
      state.windowStart = now;
    }

    // Check limit
    if (state.requestCount >= this.RATE_LIMIT) {
      const waitTime = this.RATE_WINDOW - (now - state.windowStart);
      this.logger.warn(`Rate limit exceeded for tenant ${tenantId}, wait ${waitTime}ms`);
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`);
    }

    // Increment counter
    state.requestCount++;
    this.rateLimitState.set(tenantId, state);
  }

  /**
   * Get current rate limit status for a tenant
   */
  getRateLimitStatus(tenantId: string): { remaining: number; resetIn: number } {
    const now = Date.now();
    const state = this.rateLimitState.get(tenantId);

    if (!state || now - state.windowStart >= this.RATE_WINDOW) {
      return { remaining: this.RATE_LIMIT, resetIn: 0 };
    }

    return {
      remaining: Math.max(0, this.RATE_LIMIT - state.requestCount),
      resetIn: Math.max(0, this.RATE_WINDOW - (now - state.windowStart)),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COST TRACKING
  // ═══════════════════════════════════════════════════════════════════════

  private async trackCost(
    tenantId: string,
    model: string,
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  ): Promise<void> {
    if (!usage) return;

    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const costs = this.MODEL_COSTS[model] || { input: 0, output: 0 };
    const cost = (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;

    // Store in Redis for aggregation
    try {
      const key = `ai:cost:${tenantId}:${new Date().toISOString().split('T')[0]}`;

      // Increment daily cost counter
      await this.redis.incrbyfloat(`${key}:total`, cost);
      await this.redis.hincrby(`${key}:tokens`, 'input', inputTokens);
      await this.redis.hincrby(`${key}:tokens`, 'output', outputTokens);
      await this.redis.hincrby(`${key}:requests`, model, 1);
      await this.redis.expire(`${key}:total`, 86400 * 30); // 30 days retention
      await this.redis.expire(`${key}:tokens`, 86400 * 30);
      await this.redis.expire(`${key}:requests`, 86400 * 30);

      this.logger.debug(
        `Cost tracked: $${cost.toFixed(6)} for ${model} (${inputTokens}+${outputTokens} tokens)`
      );
    } catch (error) {
      this.logger.warn(`Cost tracking failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get cost summary for a tenant
   */
  async getCostSummary(
    tenantId: string,
    days: number = 7
  ): Promise<{
    totalCost: number;
    totalTokens: { input: number; output: number };
    byModel: Record<string, number>;
    byDay: Record<string, number>;
  }> {
    const summary = {
      totalCost: 0,
      totalTokens: { input: 0, output: 0 },
      byModel: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
    };

    try {
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        if (!dateStr) continue;

        const key = `ai:cost:${tenantId}:${dateStr}`;

        const [cost, tokens, requests] = await Promise.all([
          this.redis.get(`${key}:total`),
          this.redis.hgetall(`${key}:tokens`),
          this.redis.hgetall(`${key}:requests`),
        ]);

        const dayCost = parseFloat(cost || '0');
        summary.totalCost += dayCost;
        summary.byDay[dateStr] = dayCost;

        if (tokens) {
          summary.totalTokens.input += parseInt(tokens.input || '0');
          summary.totalTokens.output += parseInt(tokens.output || '0');
        }

        if (requests) {
          for (const [model, count] of Object.entries(requests)) {
            summary.byModel[model] = (summary.byModel[model] || 0) + parseInt(count);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Cost summary failed: ${getErrorMessage(error)}`);
    }

    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LEGACY METHODS (for backward compatibility)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyze video frames with Claude Vision
   * @deprecated Use analyzeVideo instead
   */
  async analyzeFrames(framePaths: string[], ocrText: string, uiDetections: any[]): Promise<any> {
    const model = this.anthropicConfig?.models?.vision || 'claude-sonnet-4-6';
    this.logger.log(`Analyzing ${framePaths.length} frames with ${model}`);
    const fs = await import('fs/promises');

    try {
      // Process frames in batches
      const batchSize = this.anthropicConfig?.vision?.batchSize || 10;
      const batches: string[][] = [];

      for (let i = 0; i < framePaths.length; i += batchSize) {
        batches.push(framePaths.slice(i, i + batchSize));
      }

      this.logger.log(`Processing ${batches.length} batches of ${batchSize} frames each`);

      // Analyze each batch
      const batchResults = await Promise.all(
        batches.map((batch, index) =>
          this.analyzeBatchLegacy(batch, index, ocrText, uiDetections, fs)
        )
      );

      // Aggregate results
      return this.aggregateVisionResults(batchResults);
    } catch (error) {
      this.logger.error(`Vision analysis failed: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  private async analyzeBatchLegacy(
    framePaths: string[],
    batchIndex: number,
    ocrText: string,
    uiDetections: any[],
    fs: any
  ): Promise<any> {
    this.logger.debug(`Analyzing batch ${batchIndex + 1}`);

    // Convert images to base64 for Anthropic format
    const imageContents: Anthropic.ImageBlockParam[] = await Promise.all(
      framePaths.map(async path => {
        const buffer = await fs.readFile(path);
        const base64 = buffer.toString('base64');
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png' as const,
            data: base64,
          },
        };
      })
    );

    const systemPrompt = `You are an expert UI/UX analyst analyzing a sequence of screenshots from a bug report video.

Your task:
1. Identify the main user interface elements visible
2. Describe the user actions being performed
3. Detect any error messages, warnings, or unexpected behavior
4. Provide recommendations for fixing the issue

Context:
- OCR extracted text: ${ocrText.substring(0, 1000)}...
- UI elements detected: ${JSON.stringify(uiDetections.slice(0, 10))}

Analyze these frames and provide:
1. A brief summary of what's happening (2-3 sentences)
2. List of UI elements (buttons, inputs, etc.)
3. User actions performed
4. Any error messages or issues detected
5. Recommendations for developers

Format your response as JSON with keys: summary, uiElements, actions, errorMessages, recommendations`;

    const model = this.anthropicConfig?.models?.vision || 'claude-sonnet-4-6';

    try {
      const response = await this.anthropicClient.messages.create({
        model,
        max_tokens: this.anthropicConfig?.vision?.maxTokens || 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: imageContents },
        ],
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      if (!content) {
        throw new Error('No response from Claude Vision');
      }

      const parsed = JSON.parse(this.extractJson(content));
      this.logger.debug(`Batch ${batchIndex + 1} analysis complete`);

      return {
        summary: parsed.summary || '',
        uiElements: parsed.uiElements || [],
        actions: parsed.actions || [],
        errorMessages: parsed.errorMessages || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      this.logger.error(`Batch ${batchIndex + 1} analysis failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  private aggregateVisionResults(batchResults: any[]): any {
    const aggregated = {
      summary: '',
      uiElements: [] as string[],
      actions: [] as string[],
      errorMessages: [] as string[],
      recommendations: [] as string[],
      confidence: 0.8,
    };

    const summaries = batchResults.map(r => r.summary).filter(Boolean);
    aggregated.summary = summaries.join(' ');

    const combineArrays = (key: string) => {
      const combined = batchResults.flatMap(r => r[key] || []);
      return [...new Set(combined)];
    };

    aggregated.uiElements = combineArrays('uiElements');
    aggregated.actions = combineArrays('actions');
    aggregated.errorMessages = combineArrays('errorMessages');
    aggregated.recommendations = combineArrays('recommendations');

    this.logger.log(
      `Vision analysis complete: ${aggregated.uiElements.length} UI elements, ${aggregated.errorMessages.length} errors detected`
    );

    return aggregated;
  }

  /**
   * Chat completion for agent orchestration
   */
  async chat(options: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    tenantId?: string;
    tools?: any[];
    response_format?: { type: 'json_object' | 'text' };
    temperature?: number;
    max_tokens?: number;
  }): Promise<{
    content: string;
    tool_calls?: any[];
  }> {
    this.logger.debug('Requesting chat completion');

    // Resolve tenant-specific client and model when tenantId is provided
    let client = this.anthropicClient;
    let model = this.anthropicConfig?.models?.chat || 'claude-sonnet-4-6';

    if (options.tenantId) {
      const resolved = await this.getAnthropicClientForTenant(options.tenantId);
      client = resolved.client;
      model = resolved.chatModel;
    }

    try {
      // Separate system message from user/assistant messages
      const systemMessages = options.messages.filter(m => m.role === 'system');
      const conversationMessages = options.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      let systemPrompt = systemMessages.map(m => m.content).join('\n\n');

      // If response_format was json_object, instruct Claude to respond with JSON
      if (options.response_format?.type === 'json_object') {
        systemPrompt += '\n\nYou must respond with valid JSON only. No markdown, no code blocks, just raw JSON.';
      }

      // Ensure conversation starts with a user message
      if (conversationMessages.length === 0 || conversationMessages[0]?.role !== 'user') {
        conversationMessages.unshift({ role: 'user', content: 'Please respond.' });
      }

      const response = await client.messages.create({
        model,
        max_tokens: options.max_tokens || 4096,
        ...(systemPrompt && { system: systemPrompt }),
        messages: conversationMessages,
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return {
        content,
        tool_calls: undefined, // Anthropic tool calling not used in this migration
      };
    } catch (error) {
      this.logger.error(`Chat completion failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Classify text into categories
   */
  async classify(options: {
    text: string;
    categories: Record<string, string[]>;
  }): Promise<Record<string, { value: string; confidence: number }>> {
    const categoryList = Object.entries(options.categories)
      .map(([name, values]) => `${name}: ${values.join(', ')}`)
      .join('\n');

    const prompt = `Classify this text into the following categories:

${categoryList}

Text: ${options.text}

Return JSON with each category as a key containing { value, confidence }`;

    const model = this.anthropicConfig?.models?.chat || 'claude-sonnet-4-6';

    try {
      const response = await this.anthropicClient.messages.create({
        model,
        max_tokens: 1024,
        system: 'You are a text classification expert. Classify text accurately. Respond ONLY with valid JSON.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
      if (!content) {
        const defaults: Record<string, { value: string; confidence: number }> = {};
        for (const [name, values] of Object.entries(options.categories)) {
          defaults[name] = { value: values[0] || '', confidence: 0.5 };
        }
        return defaults;
      }
      const result = JSON.parse(this.extractJson(content));
      return result;
    } catch (error) {
      this.logger.error(`Classification failed: ${getErrorMessage(error)}`);
      const defaults: Record<string, { value: string; confidence: number }> = {};
      for (const [name, values] of Object.entries(options.categories)) {
        defaults[name] = { value: values[0] || '', confidence: 0.5 };
      }
      return defaults;
    }
  }
}
