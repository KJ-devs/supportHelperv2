import { apiRequest, ApiError } from './client';

export interface AffectedFile {
  filePath: string;
  relevance: 'primary' | 'secondary' | 'context';
  description: string;
  codeSnippet?: string;
}

export interface Diagnosis {
  rootCause: string;
  affectedFiles: AffectedFile[];
  confidence: number;
  suggestedFix?: string;
  remainingQuestions?: string[];
  investigationLog?: Array<{ toolName: string; summary: string; timestamp: string }>;
}

export interface AgentMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  createdAt: string;
}

export async function createAgentSession(
  ticketId: string,
): Promise<{ sessionId: string; status: string }> {
  return apiRequest<{ sessionId: string; status: string }>(
    `/api/agent/v2/sessions`,
    {
      method: 'POST',
      body: JSON.stringify({ ticketId }),
    },
  );
}

export async function sendAgentMessage(
  sessionId: string,
  content: string,
): Promise<{ content: string; toolsUsed: string[] }> {
  return apiRequest<{ content: string; toolsUsed: string[] }>(
    `/api/agent/v2/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
  );
}

export async function getAgentMessages(sessionId: string): Promise<AgentMessageRecord[]> {
  return apiRequest<AgentMessageRecord[]>(
    `/api/agent/v2/sessions/${sessionId}/messages`,
  );
}

export async function getTicketSession(
  ticketId: string,
): Promise<{ sessionId: string; status: string } | null> {
  try {
    return await apiRequest<{ sessionId: string; status: string }>(
      `/api/agent/v2/tickets/${ticketId}/session`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function getTicketDiagnosis(ticketId: string): Promise<Diagnosis | null> {
  try {
    return await apiRequest<Diagnosis>(`/api/agent/v2/tickets/${ticketId}/diagnosis`);
  } catch {
    return null;
  }
}
