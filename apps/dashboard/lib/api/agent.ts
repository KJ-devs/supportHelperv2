import { apiRequest } from './client';

export interface AgentSession {
  id: string;
  ticketId: string;
  status: string;
  agentState: Record<string, unknown>;
  escalatedTo?: string;
  escalationReason?: string;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessageData[];
  ticket: {
    id: string;
    title: string;
    description: string;
    status: string;
    severity: string;
    type: string;
  };
}

export interface AgentMessageData {
  id: string;
  sessionId: string;
  role: 'user' | 'agent';
  content: string;
  channel: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const agentApi = {
  async startSession(ticketId: string): Promise<AgentSession> {
    return apiRequest<AgentSession>(`/api/agent/sessions/${ticketId}`, {
      method: 'POST',
    });
  },

  async getSession(sessionId: string): Promise<AgentSession> {
    return apiRequest<AgentSession>(`/api/agent/sessions/${sessionId}`);
  },

  async sendMessage(sessionId: string, content: string): Promise<AgentMessageData> {
    return apiRequest<AgentMessageData>(`/api/agent/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};
