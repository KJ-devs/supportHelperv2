import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface VideoAnalysisResult {
  summary: string;
  severity: string;
  severityConfidence: number;
  type: string;
  typeConfidence: number;
  keywords: string[];
  reproductionSteps: string[];
}

const EMBEDDING_BATCH_SIZE = 100;
const EMBEDDING_MAX_CHARS = 32000; // ~8191 tokens * ~4 chars/token

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private openai: OpenAI;
  private readonly embeddingModel: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured - AI features disabled');
    } else {
      this.openai = new OpenAI({ apiKey });
    }
    this.embeddingModel = this.configService.get<string>(
      'EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
  }

  /**
   * Generate embedding for a single text input.
   * Uses OpenAI text-embedding-3-small (1536 dimensions) by default.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, cannot generate embedding');
      return [];
    }

    try {
      const truncated =
        text.length > EMBEDDING_MAX_CHARS
          ? text.slice(0, EMBEDDING_MAX_CHARS)
          : text;

      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: truncated,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Generate embeddings for multiple texts in batches.
   * Batches into groups of 100 and processes sequentially to respect rate limits.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, cannot generate embeddings');
      return texts.map(() => []);
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE).map((t) =>
        t.length > EMBEDDING_MAX_CHARS ? t.slice(0, EMBEDDING_MAX_CHARS) : t,
      );

      try {
        const response = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: batch,
        });

        // Sort by index to preserve order
        const sorted = response.data.sort((a, b) => a.index - b.index);
        results.push(...sorted.map((d) => d.embedding));
      } catch (error) {
        this.logger.error(
          `Failed to generate embeddings for batch starting at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Return empty arrays for the failed batch
        results.push(...batch.map(() => []));
      }
    }

    return results;
  }

  async analyzeVideoTranscript(transcript: string, ocrText?: string): Promise<VideoAnalysisResult> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, returning mock analysis');
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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a technical support AI that analyzes bug reports and technical issues. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Extract JSON from response (in case it's wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return {
        summary: analysis.summary || 'Unable to generate summary',
        severity: analysis.severity || 'medium',
        severityConfidence: analysis.severityConfidence || 0.5,
        type: analysis.type || 'other',
        typeConfidence: analysis.typeConfidence || 0.5,
        keywords: analysis.keywords || [],
        reproductionSteps: analysis.reproductionSteps || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to analyze video: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    userContext?: Record<string, any>,
  ): Promise<VideoAnalysisResult & { enrichedDescription: string }> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, returning basic processing');
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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a technical support AI that processes and enriches bug reports. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      return {
        enrichedDescription: analysis.enrichedDescription || description,
        summary: analysis.summary || 'Unable to generate summary',
        severity: analysis.severity || 'medium',
        severityConfidence: analysis.severityConfidence || 0.5,
        type: analysis.type || 'other',
        typeConfidence: analysis.typeConfidence || 0.5,
        keywords: analysis.keywords || [],
        reproductionSteps: analysis.reproductionSteps || [],
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

  async classifyIssue(description: string): Promise<string> {
    if (!this.openai) {
      return 'other';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a technical support AI classifier. Classify the issue into one category only: crash, performance, ui, data-loss, feature-request, or other.',
          },
          {
            role: 'user',
            content: `Classify this issue: ${description}`,
          },
        ],
        max_tokens: 20,
        temperature: 0.1,
      });

      const content = response.choices[0].message.content?.toLowerCase() || 'other';
      const validTypes = ['crash', 'performance', 'ui', 'data-loss', 'feature-request', 'other'];
      return validTypes.find(t => content.includes(t)) || 'other';
    } catch (error) {
      this.logger.error(`Classification failed: ${error}`);
      return 'other';
    }
  }

  async generateCompletion(prompt: string): Promise<string> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, returning empty response');
      return '';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful technical support AI assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      this.logger.error(
        `Failed to generate completion: ${error instanceof Error ? error.message : 'Unknown error'}`
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
