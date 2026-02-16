import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../../../ai/ai.service';

export interface ResolutionSummary {
  summary: string;
  changes: string[];
  version?: string;
}

export interface PrDetails {
  prNumber?: number;
  prUrl?: string;
  branchName?: string;
  title?: string;
  body?: string;
}

@Injectable()
export class ResolutionSummaryService {
  private readonly logger = new Logger(ResolutionSummaryService.name);

  constructor(private readonly aiService: AIService) {}

  /**
   * Generate a client-friendly resolution summary using AI.
   * Falls back to a simple template if AI is unavailable.
   */
  async generateResolutionSummary(
    ticket: {
      id: string;
      title?: string | null;
      description?: string | null;
      type?: string | null;
      severity?: string | null;
    },
    prDetails?: PrDetails,
  ): Promise<ResolutionSummary> {
    const prompt = this.buildPrompt(ticket, prDetails);

    try {
      const response = await this.aiService.generateCompletion(prompt);

      if (!response) {
        return this.getFallbackSummary(ticket, prDetails);
      }

      // Try parsing as JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary:
            parsed.summary ||
            `The issue "${ticket.title || 'reported'}" has been resolved.`,
          changes: Array.isArray(parsed.changes) ? parsed.changes : [],
          version: parsed.version || undefined,
        };
      }

      // If not JSON, use the raw text as summary
      return {
        summary: response.trim(),
        changes: [],
      };
    } catch (error) {
      this.logger.warn(
        `Failed to generate AI resolution summary for ticket ${ticket.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return this.getFallbackSummary(ticket, prDetails);
    }
  }

  private buildPrompt(
    ticket: {
      title?: string | null;
      description?: string | null;
      type?: string | null;
      severity?: string | null;
    },
    prDetails?: PrDetails,
  ): string {
    return `Given this bug report and the code changes made, explain in simple, non-technical terms what was fixed and where. Be friendly and concise.

Bug Report:
- Title: ${ticket.title || 'N/A'}
- Description: ${ticket.description || 'N/A'}
- Type: ${ticket.type || 'N/A'}
- Severity: ${ticket.severity || 'N/A'}

${
  prDetails
    ? `Code Changes (PR):
- PR Title: ${prDetails.title || 'N/A'}
- Branch: ${prDetails.branchName || 'N/A'}
- Description: ${prDetails.body || 'N/A'}`
    : 'No PR details available.'
}

Respond with a JSON object containing:
- summary: A friendly 2-3 sentence explanation for the end user
- changes: An array of 1-3 bullet points describing what changed
- version: The version number if mentioned, otherwise omit

Respond ONLY with valid JSON.`;
  }

  private getFallbackSummary(
    ticket: {
      title?: string | null;
      description?: string | null;
    },
    prDetails?: PrDetails,
  ): ResolutionSummary {
    const title = ticket.title || 'your reported issue';
    return {
      summary: `Good news! The issue "${title}" has been resolved. Our team has reviewed the problem and applied a fix that should address the behavior you reported.`,
      changes: prDetails?.title
        ? [`Fix applied: ${prDetails.title}`]
        : ['A fix has been applied to resolve the reported issue.'],
    };
  }
}
