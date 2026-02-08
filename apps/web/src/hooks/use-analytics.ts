'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import type {
  AnalyticsMetricsResponse,
  TicketsPerDayResponse,
  TicketsByTypeResponse,
  TicketsBySeverityResponse,
  ResolutionTrendResponse,
  TopApplicationsResponse,
  AIConfidenceResponse,
  ApplicationsListResponse,
  DateRange,
} from '@/types/analytics';

const API_BASE = '/api';
const POLLING_INTERVAL = 30000; // 30 seconds

// Query keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  metrics: (dateRange: DateRange, applicationId?: string | null) =>
    [...analyticsKeys.all, 'metrics', dateRange, applicationId] as const,
  ticketsPerDay: (dateRange: DateRange, applicationId?: string | null) =>
    [...analyticsKeys.all, 'ticketsPerDay', dateRange, applicationId] as const,
  ticketsByType: (dateRange: DateRange, applicationId?: string | null) =>
    [...analyticsKeys.all, 'ticketsByType', dateRange, applicationId] as const,
  ticketsBySeverity: (dateRange: DateRange, applicationId?: string | null) =>
    [...analyticsKeys.all, 'ticketsBySeverity', dateRange, applicationId] as const,
  resolutionTrend: (dateRange: DateRange, applicationId?: string | null) =>
    [...analyticsKeys.all, 'resolutionTrend', dateRange, applicationId] as const,
  topApplications: (dateRange: DateRange) =>
    [...analyticsKeys.all, 'topApplications', dateRange] as const,
  aiConfidence: (dateRange: DateRange, applicationId?: string | null) =>
    [...analyticsKeys.all, 'aiConfidence', dateRange, applicationId] as const,
  applications: () => [...analyticsKeys.all, 'applications'] as const,
};

// Helper function to build query params
function buildQueryParams(dateRange: DateRange, applicationId?: string | null): URLSearchParams {
  const params = new URLSearchParams({
    from: dateRange.from.toISOString(),
    to: dateRange.to.toISOString(),
  });
  if (applicationId) {
    params.set('applicationId', applicationId);
  }
  return params;
}

// Mock data generators (replace with real API calls)
function generateMockMetrics(): AnalyticsMetricsResponse {
  return {
    metrics: {
      totalTickets: Math.floor(Math.random() * 500) + 100,
      totalTicketsChange: Math.random() * 30 - 15,
      avgResolutionTime: Math.random() * 24 + 2,
      avgResolutionTimeChange: Math.random() * 20 - 10,
      aiAccuracy: Math.random() * 15 + 80,
      aiAccuracyChange: Math.random() * 10 - 5,
      activeUsers: Math.floor(Math.random() * 100) + 20,
      activeUsersChange: Math.random() * 20 - 10,
    },
    period: {
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
  };
}

function generateMockTicketsPerDay(days: number = 7): TicketsPerDayResponse {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      tickets: Math.floor(Math.random() * 50) + 10,
    });
  }
  return {
    data,
    period: {
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
  };
}

function generateMockTicketsByType(): TicketsByTypeResponse {
  const types = [
    { type: 'bug', color: '#ef4444' },
    { type: 'feature', color: '#3b82f6' },
    { type: 'ui', color: '#8b5cf6' },
    { type: 'performance', color: '#f59e0b' },
    { type: 'security', color: '#dc2626' },
    { type: 'documentation', color: '#10b981' },
    { type: 'other', color: '#6b7280' },
  ];
  const data = types.map(t => ({
    ...t,
    count: Math.floor(Math.random() * 100) + 5,
  }));
  return {
    data,
    total: data.reduce((sum, d) => sum + d.count, 0),
  };
}

function generateMockTicketsBySeverity(): TicketsBySeverityResponse {
  const severities = [
    { severity: 'critical', color: '#dc2626' },
    { severity: 'high', color: '#f59e0b' },
    { severity: 'medium', color: '#3b82f6' },
    { severity: 'low', color: '#10b981' },
  ];
  const data = severities.map(s => ({
    ...s,
    count: Math.floor(Math.random() * 80) + 10,
  }));
  return {
    data,
    total: data.reduce((sum, d) => sum + d.count, 0),
  };
}

function generateMockResolutionTrend(days: number = 7): ResolutionTrendResponse {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      avgTime: Math.random() * 12 + 2,
    });
  }
  return {
    data,
    period: {
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
  };
}

function generateMockTopApplications(): TopApplicationsResponse {
  const apps = [
    { applicationId: '1', applicationName: 'Mobile App' },
    { applicationId: '2', applicationName: 'Web Dashboard' },
    { applicationId: '3', applicationName: 'API Gateway' },
    { applicationId: '4', applicationName: 'Admin Portal' },
    { applicationId: '5', applicationName: 'Billing Service' },
  ];
  const data = apps
    .map(app => ({
      ...app,
      ticketCount: Math.floor(Math.random() * 150) + 20,
    }))
    .sort((a, b) => b.ticketCount - a.ticketCount);
  return {
    data,
    total: data.reduce((sum, d) => sum + d.ticketCount, 0),
  };
}

function generateMockAIConfidence(days: number = 7): AIConfidenceResponse {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      avgConfidence: Math.random() * 15 + 80,
      totalPredictions: Math.floor(Math.random() * 200) + 50,
    });
  }
  return {
    data,
    period: {
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      to: new Date(),
    },
  };
}

function generateMockApplications(): ApplicationsListResponse {
  return {
    data: [
      { id: '1', name: 'Mobile App' },
      { id: '2', name: 'Web Dashboard' },
      { id: '3', name: 'API Gateway' },
      { id: '4', name: 'Admin Portal' },
      { id: '5', name: 'Billing Service' },
    ],
  };
}

// Fetch functions (using mock data for now, replace with real API calls)
async function fetchMetrics(
  dateRange: DateRange,
  applicationId?: string | null
): Promise<AnalyticsMetricsResponse> {
  // const params = buildQueryParams(dateRange, applicationId);
  // const response = await fetch(`${API_BASE}/analytics/metrics?${params}`);
  // if (!response.ok) throw new Error('Failed to fetch metrics');
  // return response.json();

  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 500));
  return generateMockMetrics();
}

async function fetchTicketsPerDay(
  dateRange: DateRange,
  applicationId?: string | null
): Promise<TicketsPerDayResponse> {
  await new Promise(resolve => setTimeout(resolve, 400));
  const daysDiff = Math.ceil(
    (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
  );
  return generateMockTicketsPerDay(daysDiff);
}

async function fetchTicketsByType(
  dateRange: DateRange,
  applicationId?: string | null
): Promise<TicketsByTypeResponse> {
  await new Promise(resolve => setTimeout(resolve, 350));
  return generateMockTicketsByType();
}

async function fetchTicketsBySeverity(
  dateRange: DateRange,
  applicationId?: string | null
): Promise<TicketsBySeverityResponse> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return generateMockTicketsBySeverity();
}

async function fetchResolutionTrend(
  dateRange: DateRange,
  applicationId?: string | null
): Promise<ResolutionTrendResponse> {
  await new Promise(resolve => setTimeout(resolve, 450));
  const daysDiff = Math.ceil(
    (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
  );
  return generateMockResolutionTrend(daysDiff);
}

async function fetchTopApplications(dateRange: DateRange): Promise<TopApplicationsResponse> {
  await new Promise(resolve => setTimeout(resolve, 380));
  return generateMockTopApplications();
}

async function fetchAIConfidence(
  dateRange: DateRange,
  applicationId?: string | null
): Promise<AIConfidenceResponse> {
  await new Promise(resolve => setTimeout(resolve, 420));
  const daysDiff = Math.ceil(
    (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
  );
  return generateMockAIConfidence(daysDiff);
}

async function fetchApplications(): Promise<ApplicationsListResponse> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return generateMockApplications();
}

// Individual hooks
export function useAnalyticsMetrics(dateRange: DateRange, applicationId?: string | null) {
  return useQuery({
    queryKey: analyticsKeys.metrics(dateRange, applicationId),
    queryFn: () => fetchMetrics(dateRange, applicationId),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useTicketsPerDay(dateRange: DateRange, applicationId?: string | null) {
  return useQuery({
    queryKey: analyticsKeys.ticketsPerDay(dateRange, applicationId),
    queryFn: () => fetchTicketsPerDay(dateRange, applicationId),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useTicketsByType(dateRange: DateRange, applicationId?: string | null) {
  return useQuery({
    queryKey: analyticsKeys.ticketsByType(dateRange, applicationId),
    queryFn: () => fetchTicketsByType(dateRange, applicationId),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useTicketsBySeverity(dateRange: DateRange, applicationId?: string | null) {
  return useQuery({
    queryKey: analyticsKeys.ticketsBySeverity(dateRange, applicationId),
    queryFn: () => fetchTicketsBySeverity(dateRange, applicationId),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useResolutionTrend(dateRange: DateRange, applicationId?: string | null) {
  return useQuery({
    queryKey: analyticsKeys.resolutionTrend(dateRange, applicationId),
    queryFn: () => fetchResolutionTrend(dateRange, applicationId),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useTopApplications(dateRange: DateRange) {
  return useQuery({
    queryKey: analyticsKeys.topApplications(dateRange),
    queryFn: () => fetchTopApplications(dateRange),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useAIConfidence(dateRange: DateRange, applicationId?: string | null) {
  return useQuery({
    queryKey: analyticsKeys.aiConfidence(dateRange, applicationId),
    queryFn: () => fetchAIConfidence(dateRange, applicationId),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useApplicationsList() {
  return useQuery({
    queryKey: analyticsKeys.applications(),
    queryFn: fetchApplications,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Combined hook using useQueries for parallel fetching
export function useAnalyticsDashboard(dateRange: DateRange, applicationId?: string | null) {
  const results = useQueries({
    queries: [
      {
        queryKey: analyticsKeys.metrics(dateRange, applicationId),
        queryFn: () => fetchMetrics(dateRange, applicationId),
        refetchInterval: POLLING_INTERVAL,
      },
      {
        queryKey: analyticsKeys.ticketsPerDay(dateRange, applicationId),
        queryFn: () => fetchTicketsPerDay(dateRange, applicationId),
        refetchInterval: POLLING_INTERVAL,
      },
      {
        queryKey: analyticsKeys.ticketsByType(dateRange, applicationId),
        queryFn: () => fetchTicketsByType(dateRange, applicationId),
        refetchInterval: POLLING_INTERVAL,
      },
      {
        queryKey: analyticsKeys.ticketsBySeverity(dateRange, applicationId),
        queryFn: () => fetchTicketsBySeverity(dateRange, applicationId),
        refetchInterval: POLLING_INTERVAL,
      },
      {
        queryKey: analyticsKeys.resolutionTrend(dateRange, applicationId),
        queryFn: () => fetchResolutionTrend(dateRange, applicationId),
        refetchInterval: POLLING_INTERVAL,
      },
      {
        queryKey: analyticsKeys.topApplications(dateRange),
        queryFn: () => fetchTopApplications(dateRange),
        refetchInterval: POLLING_INTERVAL,
      },
      {
        queryKey: analyticsKeys.aiConfidence(dateRange, applicationId),
        queryFn: () => fetchAIConfidence(dateRange, applicationId),
        refetchInterval: POLLING_INTERVAL,
      },
    ],
  });

  const [
    metricsQuery,
    ticketsPerDayQuery,
    ticketsByTypeQuery,
    ticketsBySeverityQuery,
    resolutionTrendQuery,
    topApplicationsQuery,
    aiConfidenceQuery,
  ] = results;

  const isLoading = results.some(r => r.isLoading);
  const isError = results.some(r => r.isError);
  const isFetching = results.some(r => r.isFetching);

  return {
    metrics: metricsQuery.data,
    ticketsPerDay: ticketsPerDayQuery.data,
    ticketsByType: ticketsByTypeQuery.data,
    ticketsBySeverity: ticketsBySeverityQuery.data,
    resolutionTrend: resolutionTrendQuery.data,
    topApplications: topApplicationsQuery.data,
    aiConfidence: aiConfidenceQuery.data,
    isLoading,
    isError,
    isFetching,
    queries: {
      metrics: metricsQuery,
      ticketsPerDay: ticketsPerDayQuery,
      ticketsByType: ticketsByTypeQuery,
      ticketsBySeverity: ticketsBySeverityQuery,
      resolutionTrend: resolutionTrendQuery,
      topApplications: topApplicationsQuery,
      aiConfidence: aiConfidenceQuery,
    },
  };
}
