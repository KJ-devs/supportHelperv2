import { apiRequest } from './client';

export interface RelatedTicketFix {
  suggestedFix?: string;
  prUrl?: string;
  prNumber?: number;
}

export interface TicketRelation {
  id: string;
  relationType: 'duplicate' | 'similar' | 'related';
  direction: 'outgoing' | 'incoming';
  createdBy: string;
  confidence: number | null;
  createdAt: string;
  relatedTicket: {
    id: string;
    title: string | null;
    status: string;
    severity: string | null;
    type: string | null;
    fix: RelatedTicketFix;
  };
}

export const ticketRelationsApi = {
  async getRelations(ticketId: string): Promise<TicketRelation[]> {
    return apiRequest<TicketRelation[]>(`/api/tickets/${ticketId}/relations`);
  },

  async createRelation(
    ticketId: string,
    data: { targetTicketId: string; relationType: string; confidence?: number },
  ): Promise<unknown> {
    return apiRequest(`/api/tickets/${ticketId}/relations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteRelation(ticketId: string, relationId: string): Promise<void> {
    await apiRequest(`/api/tickets/${ticketId}/relations/${relationId}`, {
      method: 'DELETE',
    });
  },
};
