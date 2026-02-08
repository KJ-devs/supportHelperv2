// Analytics Types for SaaS Support Dashboard

// Date range presets
export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

// Metric Cards Types
export interface MetricCard {
  title: string;
  value: number | string;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  suffix?: string;
  prefix?: string;
}

export interface AnalyticsMetrics {
  totalTickets: number;
  totalTicketsChange: number;
  avgResolutionTime: number; // in hours
  avgResolutionTimeChange: number;
  aiAccuracy: number; // percentage 0-100
  aiAccuracyChange: number;
  activeUsers: number;
  activeUsersChange: number;
}

// Chart Data Types
export interface TicketsPerDayData {
  date: string;
  tickets: number;
}

export interface TicketsByTypeData {
  type: string;
  count: number;
  color: string;
}

export type TicketType =
  | 'bug'
  | 'feature'
  | 'ui'
  | 'performance'
  | 'security'
  | 'documentation'
  | 'other';

export interface TicketsBySeverityData {
  severity: string;
  count: number;
  color: string;
}

export type TicketSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ResolutionTrendData {
  date: string;
  avgTime: number; // in hours
}

export interface TopApplicationData {
  applicationId: string;
  applicationName: string;
  ticketCount: number;
}

export interface AIConfidenceData {
  date: string;
  avgConfidence: number; // percentage 0-100
  totalPredictions: number;
}

// Application for filter
export interface Application {
  id: string;
  name: string;
}

// API Response Types
export interface AnalyticsMetricsResponse {
  metrics: AnalyticsMetrics;
  period: DateRange;
}

export interface TicketsPerDayResponse {
  data: TicketsPerDayData[];
  period: DateRange;
}

export interface TicketsByTypeResponse {
  data: TicketsByTypeData[];
  total: number;
}

export interface TicketsBySeverityResponse {
  data: TicketsBySeverityData[];
  total: number;
}

export interface ResolutionTrendResponse {
  data: ResolutionTrendData[];
  period: DateRange;
}

export interface TopApplicationsResponse {
  data: TopApplicationData[];
  total: number;
}

export interface AIConfidenceResponse {
  data: AIConfidenceData[];
  period: DateRange;
}

export interface ApplicationsListResponse {
  data: Application[];
}

// Filter State
export interface AnalyticsFilters {
  dateRange: DateRange;
  dateRangePreset: DateRangePreset;
  applicationId: string | null;
}
