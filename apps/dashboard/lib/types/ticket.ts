/**
 * Ticket Types
 * Définitions TypeScript pour les tickets et entités liées
 */

export type TicketStatus = 'new' | 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketType = 'bug' | 'crash' | 'performance' | 'ui' | 'feature_request' | 'other';
export type TicketSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Ticket {
  id: string;
  tenantId: string;
  applicationId: string;
  reporterId?: string;
  assignedTo?: string;
  title: string;
  description: string;
  status: TicketStatus;
  type: TicketType;
  typeConfidence?: number;
  severity: TicketSeverity;
  severityConfidence?: number;
  userContext?: Record<string, any>;
  aiSummary?: string;
  aiAnalysis?: Record<string, any>;
  keywords?: string[];
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string;
  resolvedAt?: string;
  closedAt?: string;

  // Relations
  application?: Application;
  reporter?: User;
  assignee?: User;
  media?: Media[];
  agentSession?: AgentSession;
  agentSessions?: AgentSession[];
}

export interface Application {
  id: string;
  tenantId: string;
  name: string;
  platform: string;
  sdkKey: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'support' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

export interface Media {
  id: string;
  ticketId: string;
  type: string;
  storageKey: string;
  storageUrl?: string;
  fileSize?: bigint | number;
  mimeType?: string;
  durationMs?: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AgentSession {
  id: string;
  ticketId: string;
  status: 'active' | 'completed' | 'error';
  agentState?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  messages?: AgentMessage[];
}

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  channel: 'chat' | 'system' | 'internal';
  createdAt: string;
}

// Query Parameters
export interface TicketFilters {
  status?: TicketStatus | TicketStatus[];
  type?: TicketType | TicketType[];
  severity?: TicketSeverity | TicketSeverity[];
  applicationId?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'severity' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  bySeverity: Record<TicketSeverity, number>;
  byType: Record<TicketType, number>;
}
