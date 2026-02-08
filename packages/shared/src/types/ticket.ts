export interface Ticket {
  id: string;
  tenantId: string;
  applicationId: string;
  reporterId?: string;

  // Status & Classification
  status: TicketStatus;
  type?: TicketType;
  typeConfidence?: number;
  severity?: TicketSeverity;
  severityConfidence?: number;
  priority: number;

  // Content
  title?: string;
  description?: string;
  reproductionSteps?: ReproductionStep[];

  // User Context
  userContext?: UserContext;
  sessionId?: string;

  // AI Analysis
  aiSummary?: string;
  aiAnalysis?: AIAnalysis;
  keywords?: string[];

  // Assignment
  assignedTo?: string;
  assignedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export type TicketStatus = 
  | 'new'
  | 'analyzing'
  | 'open'
  | 'in_progress'
  | 'waiting_response'
  | 'resolved'
  | 'closed';

export type TicketType =
  | 'bug'
  | 'feature_request'
  | 'question'
  | 'performance'
  | 'security'
  | 'ui_ux'
  | 'other';

export type TicketSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export interface ReproductionStep {
  order: number;
  action: string;
  expected?: string;
  actual?: string;
  timestamp?: number;
}

export interface UserContext {
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  appVersion?: string;
  screenResolution?: string;
  language?: string;
  timezone?: string;
  customData?: Record<string, unknown>;
}

export interface AIAnalysis {
  summary: string;
  possibleCauses?: string[];
  suggestedActions?: string[];
  relatedIssues?: string[];
  confidence: number;
  processingTime: number;
}

export interface CreateTicketDto {
  applicationId: string;
  title?: string;
  description?: string;
  userContext?: UserContext;
  sessionId?: string;
}

export interface UpdateTicketDto {
  status?: TicketStatus;
  type?: TicketType;
  severity?: TicketSeverity;
  priority?: number;
  title?: string;
  description?: string;
  assignedTo?: string;
}

export interface TicketFilter {
  status?: TicketStatus | TicketStatus[];
  type?: TicketType | TicketType[];
  severity?: TicketSeverity | TicketSeverity[];
  assignedTo?: string;
  applicationId?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface TicketListResponse {
  data: Ticket[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
