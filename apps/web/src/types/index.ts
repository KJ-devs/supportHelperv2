// Ticket types
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'bug' | 'feature' | 'question' | 'billing' | 'other';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  tags: string[];
  customerId: string;
  customer: User;
  assigneeId: string | null;
  assignee: User | null;
  videoUrl: string | null;
  githubIssueId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Re-export detailed ticket types
export * from './ticket';

// User types
export type UserRole = 'admin' | 'agent' | 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

// Timeline types
export type TimelineEventType =
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'priority_changed'
  | 'comment'
  | 'tag_added'
  | 'tag_removed'
  | 'linked_github'
  | 'resolved';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  ticketId: string;
  userId: string;
  user: User;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// GitHub types
export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  openIssuesCount: number;
  stars: number;
  synced: boolean;
}

export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  repository: string;
  linkedTicketId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Analytics types
export interface AnalyticsOverview {
  totalTickets: number;
  openTickets: number;
  avgResponseTime: number;
  resolutionRate: number;
  customerSatisfaction: number;
}

export interface TicketTrend {
  date: string;
  created: number;
  resolved: number;
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
