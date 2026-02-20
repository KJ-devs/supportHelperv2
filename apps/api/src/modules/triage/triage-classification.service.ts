import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { TriageContext, TriageClassification } from './interfaces/triage.interfaces';

const TRIAGE_SYSTEM_PROMPT = `You are an expert triage agent for a technical support platform. Your job is to classify incoming support tickets into the correct category and assess their severity.

You will receive a ticket with its description, any AI-generated summary, user context (browser, OS, URL), and optionally video analysis results and similar past tickets.

## Classification Categories

1. **bug** - Something is broken, crashing, not working as expected, producing errors, or showing incorrect behavior. Includes performance issues, UI rendering bugs, data corruption, and security vulnerabilities.

2. **feature_request** - The user is asking for new functionality, improvements, enhancements, or changes to existing behavior. They describe what they WANT, not what is BROKEN.

3. **question** - The user is seeking information, guidance, or clarification. They need help understanding how something works, documentation, configuration help, or general support questions.

## Severity Assessment

For bugs:
- **critical**: Application crash, data loss, security breach, complete feature failure in production
- **high**: Major feature broken, significant performance degradation, workaround exists but is painful
- **medium**: Feature partially broken, moderate impact, reasonable workaround available
- **low**: Minor visual glitch, cosmetic issue, edge case, minimal impact

For feature requests:
- **high**: Blocking business need, many users affected
- **medium**: Useful improvement, moderate demand
- **low**: Nice-to-have, single user request

For questions:
- Severity is always **low** unless the question implies a blocking issue

## Rules
- If the ticket is ambiguous, lean toward "bug" as it is the most common and safest default
- typeConfidence below 0.7 should trigger manual review
- Consider the user's emotional tone — frustrated users with vague descriptions likely have bugs
- URLs containing /error, /crash, stack traces, or HTTP status codes strongly indicate bugs
- Phrases like "would be nice", "can you add", "I wish" indicate feature requests
- Phrases like "how do I", "where can I find", "what is" indicate questions`;

const TRIAGE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['bug', 'feature_request', 'question'],
    },
    typeConfidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    severity: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low'],
    },
    severityConfidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    summary: {
      type: 'string',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
    },
    reasoning: {
      type: 'string',
    },
  },
  required: [
    'type',
    'typeConfidence',
    'severity',
    'severityConfidence',
    'summary',
    'keywords',
    'reasoning',
  ],
};

@Injectable()
export class TriageClassificationService {
  private readonly logger = new Logger(TriageClassificationService.name);

  constructor(private readonly aiService: AIService) {}

  /**
   * Classify a ticket using AI structured output.
   */
  async classify(
    context: TriageContext,
    tenantId: string,
  ): Promise<TriageClassification> {
    const prompt = this.buildTriagePrompt(context);

    const provider = await this.aiService.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider configured — using default classification');
      return this.defaultClassification(context);
    }

    try {
      const result = await provider.generateStructuredOutput<TriageClassification>(
        prompt,
        TRIAGE_OUTPUT_SCHEMA,
        {
          systemPrompt: TRIAGE_SYSTEM_PROMPT,
          temperature: 0.1,
          maxTokens: 1024,
        },
      );

      this.logger.debug(
        `Triage classification: type=${result.type} (${result.typeConfidence}), ` +
          `severity=${result.severity} (${result.severityConfidence})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Triage classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.defaultClassification(context);
    }
  }

  private buildTriagePrompt(ctx: TriageContext): string {
    const parts: string[] = [];

    parts.push('## Ticket to Classify');
    parts.push(`Title: ${ctx.ticket.title || 'No title'}`);
    parts.push(`Description: ${ctx.ticket.description || 'No description'}`);

    if (ctx.ticket.aiSummary) {
      parts.push(`\nAI Summary: ${ctx.ticket.aiSummary}`);
    }

    if (ctx.userContext) {
      parts.push('\n## User Environment');
      parts.push(
        `OS: ${ctx.userContext.os || 'Unknown'}, ` +
          `Browser: ${ctx.userContext.browser || 'Unknown'}, ` +
          `URL: ${ctx.userContext.url || 'Unknown'}`,
      );
    }

    if (ctx.videoAnalysis) {
      if (ctx.videoAnalysis.visualCues.errors.length > 0) {
        parts.push('\n## Error Messages from Video');
        parts.push(ctx.videoAnalysis.visualCues.errors.join('\n'));
      }
      if (ctx.videoAnalysis.ocrTexts.length > 0) {
        parts.push('\n## OCR Text from Video');
        parts.push(ctx.videoAnalysis.ocrTexts.slice(0, 10).join('\n'));
      }
    }

    if (ctx.similarTickets.length > 0) {
      parts.push('\n## Similar Past Tickets');
      for (const t of ctx.similarTickets.slice(0, 3)) {
        parts.push(
          `- "${t.title}" (type: ${t.type}, resolution: ${t.resolution || 'unresolved'})`,
        );
      }
    }

    if (ctx.ticket.existingType && ctx.ticket.existingTypeConfidence) {
      parts.push('\n## Previous Classification (from SDK inline)');
      parts.push(
        `Type: ${ctx.ticket.existingType} (confidence: ${ctx.ticket.existingTypeConfidence})`,
      );
      parts.push('Consider this as a signal but make your own independent assessment.');
    }

    parts.push('\nClassify this ticket now.');

    return parts.join('\n');
  }

  /**
   * Fallback classification when AI is unavailable.
   */
  private defaultClassification(ctx: TriageContext): TriageClassification {
    // If SDK already classified, trust that
    if (ctx.ticket.existingType && ctx.ticket.existingTypeConfidence) {
      return {
        type: ctx.ticket.existingType as TriageClassification['type'],
        typeConfidence: ctx.ticket.existingTypeConfidence,
        severity: 'medium',
        severityConfidence: 0.3,
        summary: ctx.ticket.aiSummary || ctx.ticket.title || 'Unclassified ticket',
        keywords: ctx.ticket.keywords || [],
        reasoning: 'Using existing SDK classification (AI provider unavailable)',
      };
    }

    // Default to bug with low confidence
    return {
      type: 'bug',
      typeConfidence: 0.3,
      severity: 'medium',
      severityConfidence: 0.3,
      summary: ctx.ticket.title || 'Unclassified ticket',
      keywords: [],
      reasoning: 'Default classification (no AI provider available)',
    };
  }
}
