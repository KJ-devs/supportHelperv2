import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../../../ai/ai.service';

export interface ResolutionSummary {
  summary: string;
  changes: string[];
  version?: string;
}

interface TicketInfo {
  id: string;
  title: string | null;
  description: string | null;
  type: string | null;
  severity: string | null;
}

interface PrDetails {
  prNumber: number;
  prUrl: string | null;
  branchName: string | null;
  title?: string;
  body?: string;
}

@Injectable()
export class ResolutionSummaryService {
  private readonly logger = new Logger(ResolutionSummaryService.name);

  constructor(private readonly aiService: AIService) {}

  async generateResolutionSummary(
    ticket: TicketInfo,
    prDetails?: PrDetails,
  ): Promise<ResolutionSummary> {
    const prompt = `You are a technical support assistant. A bug report has been fixed and the fix has been merged.
Generate a client-friendly resolution summary. Explain in simple terms what was fixed, without technical jargon.

Bug Report Title: ${ticket.title || 'N/A'}
Bug Report Description: ${ticket.description || 'N/A'}
Issue Type: ${ticket.type || 'N/A'}
Severity: ${ticket.severity || 'N/A'}
${prDetails ? `
PR Number: #${prDetails.prNumber}
PR URL: ${prDetails.prUrl || 'N/A'}
Branch: ${prDetails.branchName || 'N/A'}
` : ''}

Respond with a JSON object:
{
  "summary": "A 2-3 sentence summary for the client explaining what was fixed",
  "changes": ["Key change 1", "Key change 2"],
  "version": "next release"
}

Respond ONLY with valid JSON.`;

    try {
      const response = await this.aiService.generateCompletion(prompt);

      if (!response) {
        return this.getFallbackSummary(ticket);
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getFallbackSummary(ticket);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || this.getFallbackSummary(ticket).summary,
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        version: parsed.version,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to generate AI resolution summary for ticket ${ticket.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return this.getFallbackSummary(ticket);
    }
  }

  private getFallbackSummary(ticket: TicketInfo): ResolutionSummary {
    return {
      summary: `Your reported issue "${ticket.title || 'Bug Report'}" has been fixed. The fix has been merged and will be available in the next release.`,
      changes: ['The reported issue has been addressed'],
    };
  }
}
