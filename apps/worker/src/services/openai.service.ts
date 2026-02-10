import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PrismaService } from './prisma.service';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

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
// OPENAI SERVICE
// ═══════════════════════════════════════════════════════════════════════

/**
 * OpenAI Service
 *
 * Comprehensive AI operations with:
 * - GPT-4o Vision multi-frame analysis
 * - GPT-4o-mini fast classification
 * - text-embedding-3-large (3072 dimensions)
 * - Redis caching (24h TTL)
 * - Rate limiting (50 req/min)
 * - Cost tracking per tenant
 * - pgvector similarity search
 */
@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly client: OpenAI;
  private readonly config: any;
  private redis!: Redis;

  // Rate limiting
  private readonly RATE_LIMIT = 50; // requests per minute
  private readonly RATE_WINDOW = 60000; // 1 minute in ms
  private rateLimitState: Map<string, RateLimitState> = new Map();

  // Cache settings
  private readonly EMBEDDING_CACHE_TTL = 86400; // 24 hours in seconds
  private readonly EMBEDDING_CACHE_PREFIX = 'openai:embedding:';

  // Cost per 1K tokens (approximate)
  private readonly MODEL_COSTS: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.config = this.configService.get('openai');
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });
  }

  async onModuleInit() {
    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.logger.log('OpenAI Service initialized with Redis caching');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIDEO ANALYSIS (GPT-4o Vision)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Analyze video frames with GPT-4o Vision
   * Multi-frame analysis for comprehensive bug understanding
   */
  async analyzeVideo(
    frames: Buffer[],
    tenantId: string,
    context?: { ocrText?: string; uiDetections?: any[] }
  ): Promise<VideoAnalysis> {
    this.logger.log(`Analyzing ${frames.length} frames with GPT-4o Vision`);

    // Check rate limit
    await this.checkRateLimit(tenantId);

    try {
      // Convert frames to base64 (max 10 frames for efficiency)
      const selectedFrames = this.selectKeyFrames(frames, 10);
      const imageContents = selectedFrames.map(buffer => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/png;base64,${buffer.toString('base64')}`,
          detail: 'high' as const,
        },
      }));

      const systemPrompt = this.buildVideoAnalysisPrompt(context);

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze these video frames from a bug report:' },
              ...imageContents,
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      // Track costs
      await this.trackCost(tenantId, 'gpt-4o', response.usage);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4o Vision');
      }

      const parsed = JSON.parse(content);
      return this.normalizeVideoAnalysis(parsed);
    } catch (error) {
      this.logger.error(`Video analysis failed: ${getErrorMessage(error)}`, getErrorStack(error));

      // Return fallback analysis
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

    prompt += `\n\nRespond in JSON format:
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
  // TICKET CLASSIFICATION (GPT-4o-mini)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fast ticket classification with GPT-4o-mini
   */
  async classifyTicket(text: string, tenantId: string): Promise<Classification> {
    this.logger.debug(`Classifying ticket (${text.length} chars)`);

    // Check rate limit
    await this.checkRateLimit(tenantId);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a bug triage expert. Classify the following support ticket/bug report.

Classify into:
- Type: bug (error/crash), feature (missing functionality), ui (visual issue), performance (slow/laggy), security (vulnerability)
- Severity: critical (app crash/data loss), high (major feature broken), medium (minor bug), low (cosmetic)
- Keywords: Extract 3-7 relevant technical keywords

Respond in JSON:
{
  "type": "bug|feature|ui|performance|security",
  "severity": "critical|high|medium|low",
  "keywords": ["keyword1", "keyword2", ...],
  "confidence": { "type": 0.0-1.0, "severity": 0.0-1.0 }
}`,
          },
          {
            role: 'user',
            content: text.substring(0, 4000), // Limit input length
          },
        ],
        max_tokens: 500,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      // Track costs
      await this.trackCost(tenantId, 'gpt-4o-mini', response.usage);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4o-mini');
      }

      const parsed = JSON.parse(content);
      return this.normalizeClassification(parsed);
    } catch (error) {
      this.logger.error(`Classification failed: ${getErrorMessage(error)}`);
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

  // ═══════════════════════════════════════════════════════════════════════
  // EMBEDDINGS (text-embedding-3-large)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate embedding with Redis caching (24h TTL)
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

    // Rate limit check
    if (tenantId) {
      await this.checkRateLimit(tenantId);
    }

    try {
      // Truncate text if too long (max ~8000 tokens)
      const truncated = text.substring(0, 32000);

      const response = await this.client.embeddings.create({
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
      // The embedding column should have an HNSW index: CREATE INDEX ON tickets USING hnsw (embedding vector_cosine_ops)
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

      const params: any[] = [embeddingStr];
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

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as any[];

      return results.map(row => ({
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        similarity: parseFloat(row.similarity) || 0,
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
      const key = `openai:cost:${tenantId}:${new Date().toISOString().split('T')[0]}`;

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

        const key = `openai:cost:${tenantId}:${dateStr}`;

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
   * Analyze video frames with GPT-4 Vision
   * @deprecated Use analyzeVideo instead
   */
  async analyzeFrames(framePaths: string[], ocrText: string, uiDetections: any[]): Promise<any> {
    this.logger.log(`Analyzing ${framePaths.length} frames with GPT-4 Vision`);
    const fs = await import('fs/promises');

    try {
      // Process frames in batches
      const batchSize = this.config.vision?.batchSize || 10;
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

    // Convert images to base64
    const imageContents = await Promise.all(
      framePaths.map(async path => {
        const buffer = await fs.readFile(path);
        const base64 = buffer.toString('base64');
        return {
          type: 'image_url' as const,
          image_url: {
            url: `data:image/png;base64,${base64}`,
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

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.models?.vision || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: imageContents },
        ],
        max_tokens: this.config.vision?.maxTokens || 4096,
        temperature: this.config.vision?.temperature || 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4 Vision');
      }

      const parsed = JSON.parse(content);
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
   * Chat completion with tools support for agent orchestration
   */
  async chat(options: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    tools?: any[];
    response_format?: { type: 'json_object' | 'text' };
    temperature?: number;
    max_tokens?: number;
  }): Promise<{
    content: string;
    tool_calls?: any[];
  }> {
    this.logger.debug('Requesting chat completion');

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.models?.chat || 'gpt-4o',
        messages: options.messages,
        ...(options.tools && { tools: options.tools, tool_choice: 'auto' }),
        ...(options.response_format && { response_format: options.response_format }),
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4096,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }
      const message = choice.message;
      return {
        content: message.content || '',
        tool_calls: message.tool_calls,
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

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.models?.chat || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a text classification expert. Classify text accurately.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message.content) {
        const defaults: Record<string, { value: string; confidence: number }> = {};
        for (const [name, values] of Object.entries(options.categories)) {
          defaults[name] = { value: values[0] || '', confidence: 0.5 };
        }
        return defaults;
      }
      const result = JSON.parse(choice.message.content || '{}');
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
