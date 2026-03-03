import { apiRequest } from './client';
import type { N1Assessment } from '@/lib/types/ticket';

interface N1AssessmentResponse {
  ticketId: string;
  assessment: N1Assessment | null;
  decision: string | null;
  assessedAt: string | null;
}

export const n1TriageApi = {
  async getAssessment(ticketId: string): Promise<N1AssessmentResponse> {
    return apiRequest<N1AssessmentResponse>(`/api/n1-triage/${ticketId}/assessment`);
  },

  async overrideDecision(ticketId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/n1-triage/${ticketId}/override`, {
      method: 'POST',
    });
  },
};
