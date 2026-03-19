import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { AiPromptConfigService } from '../ai-config/ai-prompt-config.service';
import { TriageContext, TriageClassification } from './interfaces/triage.interfaces';
import { sanitizeForPrompt } from '../../common/utils/prompt-sanitizer';

export const TRIAGE_SYSTEM_PROMPT = `You are an expert triage agent for a technical support platform. Your job is to classify incoming support tickets into the correct category and assess their severity.

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

## Classification rules for ambiguous cases
- If the user describes behavior that is BROKEN (crashes, errors, data loss, unexpected exceptions, UI not rendering) → classify as "bug"
- If the user describes behavior that WORKS but is not what they want (missing feature, different UX preference, enhancement request) → classify as "feature_request"
- If the user asks how to do something → classify as "question"
- Do NOT default to "bug" when uncertain. Instead, lower your typeConfidence score below 0.7 to signal the need for human review.
- URLs containing /error, /crash, stack traces, or HTTP status codes strongly indicate bugs
- Phrases like "would be nice", "can you add", "I wish" indicate feature requests
- Phrases like "how do I", "where can I find", "what is" indicate questions

## Intent evaluation (isWorkingAsIntended)
In addition to classification, evaluate whether the reported behavior appears to be WORKING AS INTENDED:
- Consider: Does the user describe a complete, functional interaction that just doesn't meet their expectations?
- Consider: Are there signs this is a design choice (e.g., limitations, specific formats, access controls)?
- Consider: Does the user expect functionality that may not have been built yet?
- Set isWorkingAsIntended=true with high confidence when the behavior clearly sounds like a design decision
- Set isWorkingAsIntended=false with high confidence when there are clear error signals (crashes, 500 errors, data corruption)
- Set low confidence (<0.5) when you cannot determine intent from the available information`;

export const TRIAGE_OUTPUT_SCHEMA = {
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
    isWorkingAsIntended: {
      type: 'boolean',
    },
    workingAsIntendedConfidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    workingAsIntendedReasoning: {
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
    'isWorkingAsIntended',
    'workingAsIntendedConfidence',
    'workingAsIntendedReasoning',
  ],
};

@Injectable()
export class TriageClassificationService {
  private readonly logger = new Logger(TriageClassificationService.name);

  constructor(
    private readonly aiService: AIService,
    private readonly aiPromptConfigService: AiPromptConfigService
  ) {}

  /**
   * Classify a ticket using AI structured output.
   */
  async classify(context: TriageContext, tenantId: string): Promise<TriageClassification> {
    const { enableTriage } = await this.aiPromptConfigService.getFeatureFlags(tenantId);

    if (!enableTriage) {
      this.logger.log('Triage AI disabled for tenant, using defaults');
      return this.disabledClassification(context);
    }

    const prompt = this.buildTriagePrompt(context);

    const provider = await this.aiService.getActiveProvider(tenantId);

    if (!provider) {
      this.logger.warn('No AI provider configured — using default classification');
      return this.defaultClassification(context);
    }

    try {
      // Append tenant custom instructions to system prompt
      const customInstructions = await this.aiPromptConfigService.buildCustomInstructions(
        tenantId,
        'triage'
      );
      const systemPrompt = TRIAGE_SYSTEM_PROMPT + customInstructions;

      const tuningParams = await this.aiPromptConfigService.getAiTuningParams(tenantId);

      const result = await provider.generateStructuredOutput<TriageClassification>(
        prompt,
        TRIAGE_OUTPUT_SCHEMA,
        {
          systemPrompt,
          temperature: tuningParams.triageTemperature,
          maxTokens: 1024,
        }
      );

      this.logger.debug(
        `Triage classification: type=${result.type} (${result.typeConfidence}), ` +
          `severity=${result.severity} (${result.severityConfidence})`
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Triage classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return this.defaultClassification(context);
    }
  }

  private buildTriagePrompt(ctx: TriageContext): string {
    const parts: string[] = [];

    const title = sanitizeForPrompt(ctx.ticket.title, { maxLength: 500, fieldName: 'title' });
    const description = sanitizeForPrompt(ctx.ticket.description, {
      maxLength: 10_000,
      fieldName: 'description',
    });

    parts.push('## Ticket to Classify');
    parts.push(`Title: ${title || 'No title'}`);
    parts.push(`Description: ${description || 'No description'}`);

    if (ctx.ticket.aiSummary) {
      const safeAiSummary = sanitizeForPrompt(ctx.ticket.aiSummary, {
        maxLength: 2000,
        fieldName: 'ai_summary',
      });
      parts.push(`\nAI Summary: ${safeAiSummary}`);
    }

    if (ctx.userContext) {
      parts.push('\n## User Environment');
      parts.push(
        `OS: ${ctx.userContext.os || 'Unknown'}, ` +
          `Browser: ${ctx.userContext.browser || 'Unknown'}, ` +
          `URL: ${ctx.userContext.url || 'Unknown'}`
      );
    }

    if (ctx.videoAnalysis) {
      if (ctx.videoAnalysis.visualCues.errors.length > 0) {
        parts.push('\n## Error Messages from Video');
        parts.push(
          ctx.videoAnalysis.visualCues.errors
            .map(e => sanitizeForPrompt(e, { maxLength: 500, fieldName: 'error' }))
            .join('\n')
        );
      }
      if (ctx.videoAnalysis.ocrTexts.length > 0) {
        parts.push('\n## OCR Text from Video');
        parts.push(
          ctx.videoAnalysis.ocrTexts
            .slice(0, 10)
            .map(t => sanitizeForPrompt(t, { maxLength: 1000, fieldName: 'ocr' }))
            .join('\n')
        );
      }
    }

    const relevantSimilar = ctx.similarTickets.filter(t => t.similarity >= 0.6).slice(0, 3);
    if (relevantSimilar.length > 0) {
      parts.push('\n## Similar Resolved Tickets (use as classification hints)');
      for (const t of relevantSimilar) {
        const pct = Math.round(t.similarity * 100);
        const resolvedDate = t.resolvedAt ? t.resolvedAt.slice(0, 10) : 'unknown date';
        const confidenceTag = t.similarity > 0.9 ? ' — HIGH CONFIDENCE MATCH' : '';
        parts.push(
          `\n### [similarity: ${pct}%] "${t.title || 'Untitled'}" — RESOLVED ${resolvedDate}${confidenceTag}`
        );
        parts.push(`- Type: ${t.type || 'unknown'} | Severity: ${t.severity || 'unknown'}`);
        if (t.diagnosis) {
          parts.push(`- Root cause: ${t.diagnosis.rootCause}`);
          if (t.diagnosis.proposedFix) {
            parts.push(`- Fix applied: ${t.diagnosis.proposedFix}`);
          }
        }
        if (t.similarity < 0.9) {
          parts.push(`- Note: similar pattern — verify if still applicable`);
        }
      }
    }

    if (ctx.feedbackCorrections.length > 0) {
      parts.push(
        '\n## Human Corrections on Similar Tickets\n' +
          'The following similar tickets had their AI classifications corrected by humans. Use these corrections ' +
          "as strong signals for this ticket's classification:"
      );
      for (const c of ctx.feedbackCorrections) {
        const titlePart = c.ticketTitle ? `"${c.ticketTitle}"` : `ticket ${c.ticketId}`;
        const fromPart = c.originalValue ? ` was classified as "${c.originalValue}" but` : '';
        const reasonPart = c.reason ? ` (reason: ${c.reason})` : '';
        parts.push(
          `- ${titlePart} (${c.field})${fromPart} corrected to "${c.correctedValue ?? 'unknown'}"${reasonPart}`
        );
      }
      parts.push('\nWeight recent corrections more heavily than older ones.');
    }

    if (ctx.ticket.existingType && ctx.ticket.existingTypeConfidence) {
      parts.push('\n## Previous Classification (from SDK inline)');
      parts.push(
        `Type: ${ctx.ticket.existingType} (confidence: ${ctx.ticket.existingTypeConfidence})`
      );
      parts.push('Consider this as a signal but make your own independent assessment.');
    }

    parts.push('\nClassify this ticket now.');

    return parts.join('\n');
  }

  /**
   * Default result when triage AI is disabled for the tenant.
   */
  private disabledClassification(_ctx: TriageContext): TriageClassification {
    return {
      type: 'bug',
      typeConfidence: 0.0,
      severity: 'medium',
      severityConfidence: 0.0,
      summary: 'Triage AI disabled — manual review required',
      keywords: [],
      reasoning: 'Triage AI is disabled for this tenant',
      isWorkingAsIntended: false,
      workingAsIntendedConfidence: 0,
      workingAsIntendedReasoning: 'Triage AI disabled',
    };
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
        isWorkingAsIntended: false,
        workingAsIntendedConfidence: 0,
        workingAsIntendedReasoning: 'Cannot determine intent without AI provider',
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
      isWorkingAsIntended: false,
      workingAsIntendedConfidence: 0,
      workingAsIntendedReasoning: 'Cannot determine intent without AI provider',
    };
  }
}
