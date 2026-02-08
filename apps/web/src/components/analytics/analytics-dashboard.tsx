'use client';

import * as React from 'react';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { AnalyticsMetricCards } from '@/components/analytics/metric-cards';
import {
  TicketsPerDayChart,
  TicketsByTypeChart,
  TicketsBySeverityChart,
  ResolutionTrendChart,
  TopApplicationsChart,
  AIConfidenceChart,
} from '@/components/analytics/charts';
import {
  AnalyticsDateRangePicker,
  ApplicationSelector,
  ExportCSVButton,
} from '@/components/analytics/filters';
import { useAnalyticsDashboard, useApplicationsList } from '@/hooks/use-analytics';
import type { DateRange, DateRangePreset } from '@/types/analytics';

export function AnalyticsDashboard() {
  // Filter state
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: startOfDay(subDays(new Date(), 6)),
    to: endOfDay(new Date()),
  });
  const [dateRangePreset, setDateRangePreset] = React.useState<DateRangePreset>('7d');
  const [applicationId, setApplicationId] = React.useState<string | null>(null);

  // Data fetching with parallel queries
  const {
    metrics,
    ticketsPerDay,
    ticketsByType,
    ticketsBySeverity,
    resolutionTrend,
    topApplications,
    aiConfidence,
    isLoading,
    isFetching,
  } = useAnalyticsDashboard(dateRange, applicationId);

  const { data: applicationsData, isLoading: isLoadingApps } = useApplicationsList();

  const handleDateRangeChange = (range: DateRange, preset: DateRangePreset) => {
    setDateRange(range);
    setDateRangePreset(preset);
  };

  const handleApplicationChange = (appId: string | null) => {
    setApplicationId(appId);
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Insights and metrics for your support operations.
            {isFetching && !isLoading && (
              <span className="ml-2 inline-flex items-center text-xs">
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                Updating...
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ApplicationSelector
            applications={applicationsData?.data}
            selectedApplicationId={applicationId}
            onApplicationChange={handleApplicationChange}
            isLoading={isLoadingApps}
          />
          <AnalyticsDateRangePicker
            dateRange={dateRange}
            preset={dateRangePreset}
            onDateRangeChange={handleDateRangeChange}
          />
          <ExportCSVButton
            data={{
              metrics: metrics?.metrics,
              ticketsPerDay: ticketsPerDay?.data,
              ticketsByType: ticketsByType?.data,
              ticketsBySeverity: ticketsBySeverity?.data,
              resolutionTrend: resolutionTrend?.data,
              topApplications: topApplications?.data,
              aiConfidence: aiConfidence?.data,
            }}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Metric Cards */}
      <AnalyticsMetricCards metrics={metrics?.metrics} isLoading={isLoading} />

      {/* Charts Grid - Row 1 */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <TicketsPerDayChart data={ticketsPerDay?.data} isLoading={isLoading} />
        <TicketsByTypeChart data={ticketsByType?.data} isLoading={isLoading} />
      </div>

      {/* Charts Grid - Row 2 */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <TicketsBySeverityChart
          data={ticketsBySeverity?.data}
          total={ticketsBySeverity?.total}
          isLoading={isLoading}
        />
        <ResolutionTrendChart data={resolutionTrend?.data} isLoading={isLoading} />
      </div>

      {/* Charts Grid - Row 3 */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <TopApplicationsChart data={topApplications?.data} isLoading={isLoading} />
        <AIConfidenceChart data={aiConfidence?.data} isLoading={isLoading} />
      </div>
    </div>
  );
}
