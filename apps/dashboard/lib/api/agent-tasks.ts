import { apiRequest } from './client';

export type AgentTaskStatus =
  | 'analyzing'
  | 'plan_ready'
  | 'plan_pending_review'
  | 'plan_approved'
  | 'generating'
  | 'code_ready'
  | 'code_pending_review'
  | 'code_approved'
  | 'pushing'
  | 'pr_created'
  | 'completed'
  | 'failed'
  | 'expired';

export interface AgentTask {
  id: string;
  ticketId: string;
  tenantId: string;
  applicationId: string;
  status: AgentTaskStatus;
  actionPlan: ActionPlan | null;
  executionLog: ExecutionLogEntry[];
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  retryCount: number;
  ciErrorLog: string | null;
  prNumber: number | null;
  prUrl: string | null;
  branchName: string | null;
  createdAt: string;
  updatedAt: string;
  ticket: {
    id: string;
    title: string;
    status: string;
    severity: string;
    type: string;
  };
  application: {
    id: string;
    name: string;
  };
}

export interface ActionPlan {
  summary: string;
  rootCause: string;
  files: ActionPlanFile[];
  testingStrategy: string;
  risks: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface ActionPlanFile {
  filePath: string;
  operation: 'modify' | 'create' | 'delete';
  description: string;
  changeType: 'bug_fix' | 'enhancement' | 'refactor' | 'test';
  order: number;
}

export interface ExecutionLogEntry {
  step: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface AgentTaskFilters {
  status?: string;
  applicationId?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AgentTaskStats {
  totalTasks: number;
  inProgress: number;
  successRate: number;
  avgResolutionTime: number;
  failedCount: number;
  byStatus: Record<string, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function buildQueryString(filters: AgentTaskFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'page' && typeof value === 'number') {
        params.append(key, Math.max(0, value - 1).toString());
      } else {
        params.append(key, value.toString());
      }
    }
  });
  return params.toString();
}

export const agentTasksApi = {
  async getTasks(filters: AgentTaskFilters = {}): Promise<PaginatedResponse<AgentTask>> {
    const queryString = buildQueryString(filters);
    const endpoint = `/api/v1/agent-tasks${queryString ? `?${queryString}` : ''}`;
    return apiRequest<PaginatedResponse<AgentTask>>(endpoint);
  },

  async getTask(id: string): Promise<AgentTask> {
    return apiRequest<AgentTask>(`/api/v1/agent-tasks/${id}`);
  },

  async getStats(): Promise<AgentTaskStats> {
    return apiRequest<AgentTaskStats>('/api/v1/agent-tasks/stats');
  },

  async retryTask(id: string): Promise<AgentTask> {
    return apiRequest<AgentTask>(`/api/v1/agent-tasks/${id}/retry`, {
      method: 'POST',
    });
  },

  async cancelTask(id: string): Promise<AgentTask> {
    return apiRequest<AgentTask>(`/api/v1/agent-tasks/${id}/cancel`, {
      method: 'POST',
    });
  },

  async approveTask(id: string, phase: 'plan' | 'code'): Promise<AgentTask> {
    return apiRequest<AgentTask>(`/api/v1/agent-tasks/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase }),
    });
  },

  async rejectTask(id: string, phase: 'plan' | 'code', reason?: string): Promise<AgentTask> {
    return apiRequest<AgentTask>(`/api/v1/agent-tasks/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, reason }),
    });
  },

  async getPendingReviews(): Promise<AgentTask[]> {
    return apiRequest<AgentTask[]>('/api/v1/agent-tasks/pending-reviews');
  },
};
