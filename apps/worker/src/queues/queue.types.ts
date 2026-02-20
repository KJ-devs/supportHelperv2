/**
 * Queue Job Type Definitions
 *
 * Defines the data structures for all worker jobs
 */

// ═══════════════════════════════════════════════════════════════════════
// VIDEO ANALYSIS JOBS
// ═══════════════════════════════════════════════════════════════════════

export interface VideoAnalysisJobData {
  ticketId: string;
  mediaId: string;
  tenantId: string;
  storageKey: string;
  options?: {
    skipOcr?: boolean;
    skipYolo?: boolean;
    skipVision?: boolean;
    maxFrames?: number;
  };
}

export interface VideoAnalysisResult {
  success: boolean;
  mediaId: string;
  ticketId: string;
  framesExtracted: number;
  ocrResults?: {
    totalText: string;
    averageConfidence: number;
  };
  visionAnalysis?: {
    summary: string;
    uiElements: string[];
    actions: string[];
    errorMessages: string[];
    recommendations: string[];
  };
  embeddings?: {
    dimensions: number;
    vectorId: string;
  };
  processingTimeMs: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// GITHUB SYNC JOBS
// ═══════════════════════════════════════════════════════════════════════

export type GithubSyncJobType =
  | 'sync-issues'
  | 'create-issue'
  | 'update-issue'
  | 'webhook-event'
  | 'sync-repository';

export interface GithubSyncJobData {
  type: GithubSyncJobType;
  tenantId: string;
  connectionId: string;
  payload: GithubSyncPayload;
}

export type GithubSyncPayload =
  | GithubSyncIssuesPayload
  | GithubCreateIssuePayload
  | GithubUpdateIssuePayload
  | GithubWebhookPayload
  | GithubSyncRepoPayload;

export interface GithubSyncIssuesPayload {
  repo: string;
  since?: string;
  state?: 'open' | 'closed' | 'all';
}

export interface GithubCreateIssuePayload {
  ticketId: string;
  repo: string;
  title: string;
  body: string;
  labels?: string[];
}

export interface GithubUpdateIssuePayload {
  ticketId: string;
  issueNumber: number;
  repo: string;
  updates: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
  };
}

export interface GithubWebhookPayload {
  event: string;
  action: string;
  data: Record<string, unknown>;
}

export interface GithubSyncRepoPayload {
  repo: string;
  fullSync?: boolean;
}

export interface GithubSyncResult {
  success: boolean;
  type: GithubSyncJobType;
  itemsProcessed?: number;
  issueNumber?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// AGENT ORCHESTRATION JOBS
// ═══════════════════════════════════════════════════════════════════════

export type AgentJobType =
  | 'start-session' // Start new agent session with full state machine
  | 'process-message' // Process incoming user message
  | 'process-user-message' // Async AI response for a user message (queued by API)
  | 'auto-escalate-timeout' // Auto-escalate session after 24h with no response
  | 'analyze-ticket'
  | 'suggest-solution'
  | 'escalate-ticket'
  | 'auto-respond'
  | 'classify-ticket'
  | 'create-user-story' // Generate and create GitHub User Story from ticket
  | 'generate-action-plan' // Generate code-level action plan for a ticket (US-3.2)
  | 'generate-code' // Generate code changes, create branch and PR (US-3.3)
  | 'push-code' // Push approved code to GitHub after review (US-3.4)
  | 'generate-proposal' // Generate technical proposal for feature requests
  | 'auto-answer'; // Auto-answer support questions via RAG

export interface AgentJobData {
  type: AgentJobType;
  ticketId: string;
  tenantId: string;
  sessionId?: string;
  applicationId?: string;
  agentTaskId?: string;
  context?: AgentContext;
}

export interface AgentContext {
  // User message for process-message type
  message?: string;
  channel?: 'email' | 'github' | 'chat';

  previousMessages?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  ticketHistory?: Array<{
    ticketId: string;
    similarity: number;
  }>;
  userInfo?: {
    userId: string;
    email: string;
    name?: string;
  };

  // User Story options for create-user-story type
  userStoryOptions?: {
    repository: string;
    assignees?: string[];
    milestone?: number;
    additionalContext?: string;
  };
}

export interface AgentResult {
  success: boolean;
  type: AgentJobType;
  ticketId: string;
  response?: string;
  analysis?: TicketAnalysis;
  suggestions?: string[];
  escalated?: boolean;
  functionCalls?: FunctionCallResult[];
  metadata?: {
    sessionId?: string;
    state?: string;
    confidence?: number;
    attempts?: number;
    // User Story metadata
    issueNumber?: number;
    issueUrl?: string;
    repository?: string;
    // Code generation metadata (US-3.3)
    agentTaskId?: string;
    filesCount?: number;
    complexity?: string;
    prUrl?: string;
    prNumber?: number;
    branchName?: string;
    // Validation mode metadata (US-3.4)
    needsReview?: boolean;
  };
  error?: string;
}

export interface TicketAnalysis {
  classification: {
    type: string;
    confidence: number;
  };
  severity: {
    level: string;
    confidence: number;
  };
  keywords: string[];
  summary: string;
  reproductionSteps?: string[];
}

export interface FunctionCallResult {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

// ═══════════════════════════════════════════════════════════════════════
// CODEBASE INDEXING JOBS
// ═══════════════════════════════════════════════════════════════════════

export interface CodebaseIndexingJobData {
  type: 'full-index' | 'incremental-index' | 'reindex-file';
  applicationId: string;
  tenantId: string;
  repoFullName?: string;
  installationId?: number;
  sinceCommitSha?: string;
  triggeredBy?: 'webhook' | 'manual';
  // For reindex-file jobs only
  filePath?: string;
  commitSha?: string;
}

export interface CodebaseIndexingResult {
  success: boolean;
  type: string;
  filesProcessed: number;
  chunksCreated: number;
  duration: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// DEEP ANALYSIS JOBS (US-3.2)
// ═══════════════════════════════════════════════════════════════════════

export interface DeepAnalysisJobData {
  ticketId: string;
  tenantId: string;
  applicationId: string;
}

export interface DeepAnalysisResult {
  success: boolean;
  ticketId: string;
  diagnosisFound: boolean;
  duration: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// TRIAGE JOBS
// ═══════════════════════════════════════════════════════════════════════

export interface TriageJobData {
  ticketId: string;
  tenantId: string;
  applicationId: string;
  source?: 'dashboard' | 'sdk' | 'manual' | 'auto';
  skipClassification?: boolean;
}

export interface TriageWorkerResult {
  success: boolean;
  ticketId: string;
  routedTo: string | null;
  duration: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// JOB METADATA
// ═══════════════════════════════════════════════════════════════════════

export interface JobMetadata {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  attemptNumber: number;
  priority: number;
  progress?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION SYNC JOBS
// ═══════════════════════════════════════════════════════════════════════

export interface IntegrationSyncJobData {
  ticketId: string;
  integrationId: string;
  tenantId: string;
  action: 'create' | 'update' | 'delete';
  forceResync?: boolean;
  metadata?: {
    externalId?: string;
    triggeredBy?: 'manual' | 'auto' | 'sdk';
  };
}

export interface IntegrationPullJobData {
  integrationId: string;
  tenantId: string;
  applicationId: string;
  metadata?: {
    triggeredBy?: 'manual' | 'auto';
  };
}

export interface IntegrationSyncResult {
  success: boolean;
  integrationId: string;
  ticketId: string;
  externalId?: string;
  externalUrl?: string;
  provider: string;
  error?: string;
  attemptNumber: number;
  processingTimeMs: number;
}

export interface IntegrationPullResult {
  success: boolean;
  integrationId: string;
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  error?: string;
  processingTimeMs: number;
}
