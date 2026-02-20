/**
 * Triage Agent Interfaces
 *
 * Types for the automatic ticket classification and routing system.
 */

export interface TriageContext {
  ticket: {
    id: string;
    title: string | null;
    description: string | null;
    aiSummary: string | null;
    existingType: string | null;
    existingTypeConfidence: number | null;
    keywords: string[];
  };
  userContext: {
    os: string | null;
    browser: string | null;
    url: string | null;
    viewport: string | null;
  } | null;
  videoAnalysis: {
    ocrTexts: string[];
    visualCues: {
      errors: string[];
      urls: string[];
      components: string[];
    };
  } | null;
  codebaseMetadata: {
    hasIndexedCodebase: boolean;
    hasGithubConfig: boolean;
    repoName: string | null;
  };
  similarTickets: Array<{
    id: string;
    title: string | null;
    type: string | null;
    resolution: string | null;
    similarity: number;
  }>;
}

export interface TriageClassification {
  type: 'bug' | 'feature_request' | 'question';
  typeConfidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  severityConfidence: number;
  summary: string;
  keywords: string[];
  reasoning: string;
}

export type TriageAction =
  | 'deep_analysis'
  | 'proposal_generation'
  | 'auto_answer'
  | 'manual_triage';

export interface TriageRoute {
  action: TriageAction;
  needsReview?: boolean;
  reason?: string;
}

export interface TriageResult {
  success: boolean;
  ticketId: string;
  classification: TriageClassification | null;
  route: TriageRoute;
  duration: number;
  error?: string;
}
