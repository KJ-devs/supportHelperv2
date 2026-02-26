import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolCallResult } from './agent-tools';
import { AgenticLoopResult } from './agentic-loop.service';

export interface AffectedFile {
  filePath: string;
  relevance: 'primary' | 'secondary' | 'context';
  description: string;
  codeSnippet?: string;
}

export interface InvestigationLogEntry {
  toolName: string;
  summary: string;
  timestamp: string;
}

export interface Diagnosis {
  rootCause: string;
  affectedFiles: AffectedFile[];
  confidence: number;
  suggestedFix?: string;
  remainingQuestions?: string[];
  investigationLog?: InvestigationLogEntry[];
}

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveDiagnosis(
    ticketId: string,
    tenantId: string,
    diagnosis: Diagnosis,
    loopResult: AgenticLoopResult,
  ): Promise<void> {
    const investigationLog: InvestigationLogEntry[] = loopResult.toolCallLog.map((call) => ({
      toolName: call.name,
      summary: this.summarizeToolCall(call),
      timestamp: new Date().toISOString(),
    }));

    const diagnosisWithLog: Diagnosis = {
      ...diagnosis,
      investigationLog,
    };

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        diagnosis: diagnosisWithLog as object,
        diagnosisUpdatedAt: new Date(),
      },
    });

    this.logger.log(
      `Saved diagnosis for ticket ${ticketId} (confidence: ${diagnosis.confidence})`,
    );
  }

  async getDiagnosis(ticketId: string): Promise<Diagnosis | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { diagnosis: true },
    });

    if (!ticket?.diagnosis) {
      return null;
    }

    return ticket.diagnosis as unknown as Diagnosis;
  }

  /**
   * Extract the last update_diagnosis tool call from the loop's tool call log.
   */
  extractDiagnosisFromToolCalls(toolCallLog: ToolCallResult[]): Diagnosis | null {
    // Find the last update_diagnosis call (the most recent wins)
    const diagnosisCalls = toolCallLog.filter((c) => c.name === 'update_diagnosis');

    if (diagnosisCalls.length === 0) {
      return null;
    }

    const lastCall = diagnosisCalls[diagnosisCalls.length - 1];
    const input = lastCall.input;

    if (!input.root_cause || input.confidence === undefined) {
      return null;
    }

    const affectedFiles = this.parseAffectedFiles(
      input.affected_files as Array<{
        file_path: string;
        relevance: 'primary' | 'secondary' | 'context';
        description: string;
      }> | undefined,
    );

    return {
      rootCause: input.root_cause as string,
      affectedFiles,
      confidence: parseFloat(String(input.confidence)),
      suggestedFix: input.suggested_fix as string | undefined,
      remainingQuestions: input.remaining_questions as string[] | undefined,
    };
  }

  private parseAffectedFiles(
    raw: Array<{
      file_path: string;
      relevance: 'primary' | 'secondary' | 'context';
      description: string;
    }> | undefined,
  ): AffectedFile[] {
    if (!raw || !Array.isArray(raw)) return [];

    return raw.map((f) => ({
      filePath: f.file_path || '',
      relevance: f.relevance || 'context',
      description: f.description || '',
    }));
  }

  private summarizeToolCall(call: ToolCallResult): string {
    const input = call.input;

    switch (call.name) {
      case 'read_file':
        return `Read file: ${input.file_path}`;
      case 'list_directory':
        return `Listed directory: ${input.path}`;
      case 'search_code':
        return `Searched code for: "${input.query}"`;
      case 'search_codebase_semantic':
        return `Semantic search: "${input.query}"`;
      case 'get_repo_structure':
        return `Got repository structure`;
      case 'get_file_history':
        return `Got history for: ${input.file_path}`;
      case 'get_file_blame':
        return `Got blame for: ${input.file_path}`;
      case 'update_diagnosis':
        return `Updated diagnosis: ${input.root_cause} (confidence: ${input.confidence})`;
      case 'search_similar_tickets':
        return `Searched similar tickets: "${input.query}"`;
      case 'get_ticket_details':
        return `Got ticket details: ${input.ticket_id}`;
      case 'update_ticket_status':
        return `Updated ticket status to: ${input.status}`;
      case 'escalate_to_human':
        return `Escalated to human: ${input.reason}`;
      default:
        return `Executed tool: ${call.name}`;
    }
  }
}
