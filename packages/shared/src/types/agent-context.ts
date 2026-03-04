export type TriageType = 'bug' | 'feature' | 'question'
export type TriageSeverity = 'critical' | 'high' | 'medium' | 'low'
export type TriageRoute = 'auto-answer' | 'deep-analysis' | 'escalate'
export type AgentRole = 'triage' | 'n1' | 'n2'
export type N2Complexity = 'simple' | 'moderate' | 'complex'

export interface DecisionTraceEntry {
  agent: AgentRole
  action: string
  rationale: string
  timestamp: string
}

export interface TriageDecision {
  type: TriageType
  severity: TriageSeverity
  confidence: number
  routedTo: TriageRoute
  reasoning: string
  timestamp: string
}

export interface N1Analysis {
  summary: string
  rootCause: string
  affectedComponents: string[]
  requiresCodeChange: boolean
  escalationReason?: string
  timestamp: string
}

export interface N2Plan {
  approach: string
  filesToModify: string[]
  risks: string[]
  estimatedComplexity: N2Complexity
  timestamp: string
}

export interface AgentHandoffContext {
  ticketId: string
  tenantId: string
  triageDecision?: TriageDecision
  n1Analysis?: N1Analysis
  n2Plan?: N2Plan
  decisionTrace: DecisionTraceEntry[]
}

export interface SimilarTicketFix {
  rootCause: string
  proposedFix?: string
  affectedFiles?: string[]
  prUrl?: string | null
}

export interface SimilarTicketContext {
  id: string
  title: string | null
  aiSummary: string | null
  keywords: string[]
  type: string | null
  severity: string | null
  status: string
  similarity: number
  diagnosis?: SimilarTicketFix
  resolvedAt: string | null
}
