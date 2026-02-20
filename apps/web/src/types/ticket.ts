// Extended Ticket types for detail page

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'bug' | 'feature' | 'question' | 'billing' | 'other';
export type TicketSeverity = 'minor' | 'moderate' | 'major' | 'critical';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface VideoEvent {
  id: string;
  type: 'click' | 'scroll' | 'input' | 'navigation' | 'error' | 'network' | 'console';
  timestamp: number; // seconds into video
  description: string;
  metadata?: {
    selector?: string;
    value?: string;
    url?: string;
    errorMessage?: string;
    networkUrl?: string;
    statusCode?: number;
  };
}

export interface VideoRecording {
  id: string;
  url: string;
  duration: number; // seconds
  thumbnailUrl: string | null;
  events: VideoEvent[];
  ocrData?: OcrData[];
  createdAt: string;
}

export interface OcrData {
  timestamp: number;
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ReproductionStep {
  id: string;
  order: number;
  action: string;
  expected?: string;
  actual?: string;
  timestamp?: number; // video timestamp if applicable
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  source?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

export interface AIAnalysis {
  id: string;
  summary: string;
  rootCause?: string;
  suggestedSolution?: string;
  confidence: number; // 0-1
  relatedDocs?: Array<{
    title: string;
    url: string;
    relevance: number;
  }>;
  codeSnippets?: Array<{
    language: string;
    code: string;
    description: string;
  }>;
  createdAt: string;
}

export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
  repository: string;
  labels: string[];
  createdAt: string;
}

export interface SimilarTicket {
  id: string;
  title: string;
  status: TicketStatus;
  similarity: number; // 0-1
  resolvedAt?: string;
}

export interface FixProposedEventData {
  prUrl: string;
  prNumber: number;
  branch: string;
  title?: string;
}

export interface TicketEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type:
    | 'created'
    | 'assigned'
    | 'status_changed'
    | 'priority_changed'
    | 'comment'
    | 'tag_added'
    | 'tag_removed'
    | 'linked_github'
    | 'ai_analysis'
    | 'resolved'
    | 'fix_proposed';
  user: User;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    intent?: string;
    suggestedActions?: string[];
  };
}

export interface TicketDetail {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  severity: TicketSeverity;
  tags: string[];

  // People
  customer: User;
  assignee: User | null;

  // Media
  video: VideoRecording | null;
  screenshots: string[];

  // Content
  reproductionSteps: ReproductionStep[];
  logs: LogEntry[];
  aiAnalysis: AIAnalysis | null;

  // Relationships
  githubIssue: GitHubIssue | null;
  similarTickets: SimilarTicket[];

  // History
  activityHistory: ActivityEvent[];
  agentConversation: AgentMessage[];
  events?: TicketEvent[];

  // Metadata
  browserInfo?: {
    name: string;
    version: string;
    os: string;
  };
  pageUrl?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// API Input types
export interface UpdateTicketStatusInput {
  id: string;
  status: TicketStatus;
}

export interface AssignTicketInput {
  id: string;
  assigneeId: string | null;
}

export interface CreateGitHubIssueInput {
  ticketId: string;
  repository: string;
  title?: string;
  labels?: string[];
}
