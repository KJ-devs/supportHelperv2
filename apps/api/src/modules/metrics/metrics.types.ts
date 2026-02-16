/**
 * Metrics Types
 *
 * Type definitions for Prometheus metrics
 */

export interface HttpMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
}

export interface TicketMetrics {
  tenantId: string;
}

export interface AgentTaskMetrics {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration?: number;
}

export interface JobMetrics {
  queue: string;
  status: 'completed' | 'failed' | 'delayed' | 'active';
}
