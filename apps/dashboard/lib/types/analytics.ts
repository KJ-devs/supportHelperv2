/**
 * Analytics Types
 * Définitions pour les statistiques et métriques
 */

export interface DashboardStats {
  tickets: {
    total: number;
    new: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  applications: {
    total: number;
    active: number;
  };
  performance: {
    avgResolutionTime: number; // en heures
    avgFirstResponseTime: number; // en heures
    resolutionRate: number; // pourcentage
  };
}

export interface TicketTrend {
  date: string;
  new: number;
  resolved: number;
  total: number;
}

export interface TypeDistribution {
  type: string;
  count: number;
  percentage: number;
}

export interface SeverityDistribution {
  severity: string;
  count: number;
  percentage: number;
}

export interface ApplicationPerformance {
  applicationId: string;
  applicationName: string;
  totalTickets: number;
  openTickets: number;
  avgResolutionTime: number;
  criticalCount: number;
}

export interface TimeRange {
  start: string;
  end: string;
  preset?: '7d' | '30d' | '90d' | 'all';
}

export interface AnalyticsData {
  stats: DashboardStats;
  trends: TicketTrend[];
  typeDistribution: TypeDistribution[];
  severityDistribution: SeverityDistribution[];
  topApplications: ApplicationPerformance[];
  timeRange: TimeRange;
}
