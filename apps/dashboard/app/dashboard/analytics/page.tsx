/**
 * Analytics Page
 * Page des statistiques et métriques
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { ticketsApi } from '@/lib/api/tickets';
import { analyticsApi } from '@/lib/api/analytics';
import type { TicketStats } from '@/lib/types/ticket';
import type { ResolutionTrendsResponse, DifficultyData } from '@/lib/types/analytics';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/analytics/StatsCard';
import { SimpleBarChart } from '@/components/analytics/SimpleBarChart';
import { PieChart } from '@/components/analytics/PieChart';
import { PageLoader, Card, Button, Select, EmptyState } from '@/components/ui';
import { AlertTriangle, Ticket, ClipboardList, CheckCircle, BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('analytics');

  const [stats, setStats] = useState<TicketStats | null>(null);
  const [resolutionTrends, setResolutionTrends] = useState<ResolutionTrendsResponse | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Map UI time range to API period parameter
      const periodMap: Record<string, string> = {
        '7d': 'week',
        '30d': 'month',
        '90d': 'month',
        all: 'month',
      };
      const period = periodMap[timeRange] || 'week';

      // Get ticket stats and new analytics endpoints in parallel
      const [ticketStats, trendsData, difficultyData] = await Promise.allSettled([
        ticketsApi.getStats(period),
        analyticsApi.getResolutionTrends(),
        analyticsApi.getDifficulty(),
      ]);

      if (ticketStats.status === 'fulfilled') {
        setStats(ticketStats.value);
      } else {
        throw ticketStats.reason;
      }

      if (trendsData.status === 'fulfilled') {
        setResolutionTrends(trendsData.value);
      } else {
        console.warn('Resolution trends unavailable:', trendsData.reason);
      }

      if (difficultyData.status === 'fulfilled') {
        setDifficulty(difficultyData.value);
      } else {
        console.warn('Difficulty data unavailable:', difficultyData.reason);
      }
    } catch (err: any) {
      setError(err.message || t('errorDescription'));
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, t]);

  useEffect(() => {
    if (!authLoading) {
      fetchStats();
    }
  }, [authLoading, fetchStats]);

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (error || !stats) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <AlertTriangle
              className="w-12 h-12 mx-auto mb-4 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">
              {t('error')}
            </h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error || t('errorDescription')}</p>
            <Button variant="secondary" onClick={fetchStats}>
              {t('retry')}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Prepare chart data
  const statusData = [
    { label: t('statuses.new'), value: stats.byStatus.new || 0, color: '#3b82f6' },
    { label: t('statuses.open'), value: stats.byStatus.open || 0, color: '#f59e0b' },
    { label: t('statuses.inProgress'), value: stats.byStatus.in_progress || 0, color: '#8b5cf6' },
    { label: t('statuses.resolved'), value: stats.byStatus.resolved || 0, color: '#10b981' },
    { label: t('statuses.closed'), value: stats.byStatus.closed || 0, color: '#6b7280' },
  ];

  const severityData = [
    { label: t('severities.critical'), value: stats.bySeverity.critical || 0, color: '#dc2626' },
    { label: t('severities.high'), value: stats.bySeverity.high || 0, color: '#f59e0b' },
    { label: t('severities.medium'), value: stats.bySeverity.medium || 0, color: '#3b82f6' },
    { label: t('severities.low'), value: stats.bySeverity.low || 0, color: '#10b981' },
  ];

  const typeData = [
    { label: t('types.bug'), value: stats.byType.bug || 0, color: '#dc2626' },
    { label: t('types.crash'), value: stats.byType.crash || 0, color: '#f59e0b' },
    { label: t('types.performance'), value: stats.byType.performance || 0, color: '#8b5cf6' },
    { label: t('types.ui'), value: stats.byType.ui || 0, color: '#3b82f6' },
    {
      label: t('types.featureRequest'),
      value: stats.byType.feature_request || 0,
      color: '#10b981',
    },
    { label: t('types.other'), value: stats.byType.other || 0, color: '#6b7280' },
  ];

  const openTickets =
    (stats.byStatus.new || 0) + (stats.byStatus.open || 0) + (stats.byStatus.in_progress || 0);
  const resolvedTickets = (stats.byStatus.resolved || 0) + (stats.byStatus.closed || 0);
  const resolutionRate = stats.total > 0 ? ((resolvedTickets / stats.total) * 100).toFixed(1) : '0';

  const hasNoData = stats.total === 0;

  // Resolution trends chart data
  const getMonthLabel = (monthStr: string): string => {
    const month = monthStr.split('-')[1];
    if (!month) return monthStr;
    return t(`months.${month}` as any) ?? monthStr;
  };

  const resolvedByMonthData = resolutionTrends
    ? resolutionTrends.data.map(item => ({
        label: getMonthLabel(item.month),
        value: item.resolved,
        color: '#10b981',
      }))
    : [];

  const avgResolutionByMonthData = resolutionTrends
    ? resolutionTrends.data.map(item => ({
        label: getMonthLabel(item.month),
        value: Math.round(item.avgResolutionTimeHours * 10) / 10,
        color: '#3b82f6',
      }))
    : [];

  // N1 decision distribution for PieChart
  const n1DecisionColors: Record<string, string> = {
    no_fix_needed: '#10b981',
    duplicate: '#f59e0b',
    escalate_n2: '#dc2626',
    not_triaged: '#6b7280',
  };

  const n1PieData = difficulty
    ? difficulty.byN1Decision.map(item => ({
        label: t(`n1Decisions.${item.decision}` as any) ?? item.decision,
        value: item.count,
        color: n1DecisionColors[item.decision] ?? '#6b7280',
      }))
    : [];

  const avgResolutionBySeverityData = difficulty
    ? difficulty.avgResolutionTimeBySeverity.map(item => ({
        label: item.severity,
        value: Math.round(item.avgHours * 10) / 10,
        color: '#8b5cf6',
      }))
    : [];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{t('subtitle')}</p>
            </div>

            {/* Time Range Selector */}
            {!hasNoData && (
              <Select
                value={timeRange}
                onChange={e => setTimeRange(e.target.value as any)}
                options={[
                  { value: '7d', label: t('timeRange.7d') },
                  { value: '30d', label: t('timeRange.30d') },
                  { value: '90d', label: t('timeRange.90d') },
                  { value: 'all', label: t('timeRange.all') },
                ]}
              />
            )}
          </div>
        </div>

        {/* Empty State */}
        {hasNoData && (
          <EmptyState
            icon="📊"
            title={t('noData')}
            description={t('noDataDescription')}
            actionLabel={t('createApp')}
            actionHref="/dashboard/applications"
            variant="bordered"
          />
        )}

        {/* Key Metrics */}
        {!hasNoData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <StatsCard
                title={t('stats.totalTickets')}
                value={stats.total}
                icon={Ticket}
                subtitle={t('stats.totalSubtitle')}
                variant="primary"
              />

              <StatsCard
                title={t('stats.openTickets')}
                value={openTickets}
                icon={ClipboardList}
                subtitle={t('stats.openSubtitle')}
                variant="warning"
              />

              <StatsCard
                title={t('stats.resolvedTickets')}
                value={resolvedTickets}
                icon={CheckCircle}
                subtitle={t('stats.resolvedSubtitle')}
                variant="success"
              />

              <StatsCard
                title={t('stats.resolutionRate')}
                value={`${resolutionRate}%`}
                icon={BarChart3}
                subtitle={t('stats.resolutionSubtitle')}
                variant="default"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Status Distribution */}
              <Card>
                <SimpleBarChart title={t('charts.statusDistribution')} data={statusData} />
              </Card>

              {/* Severity Distribution */}
              <Card>
                <PieChart title={t('charts.severityDistribution')} data={severityData} size={180} />
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 gap-6 mb-6">
              <Card>
                <SimpleBarChart title={t('charts.typeDistribution')} data={typeData} />
              </Card>
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  🔴 {t('cards.criticalTickets')}
                </h3>
                <p className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
                  {stats.bySeverity.critical || 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('cards.criticalDescription')}
                </p>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  🐛 {t('cards.bugsReported')}
                </h3>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  {stats.byType.bug || 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('cards.bugsDescription')}
                </p>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  💥 {t('cards.crashes')}
                </h3>
                <p className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  {stats.byType.crash || 0}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('cards.crashesDescription')}
                </p>
              </Card>
            </div>

            {/* Resolution Trends — Tickets résolus par mois */}
            {resolutionTrends ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  <Card>
                    <SimpleBarChart
                      title={t('charts.resolvedByMonth')}
                      data={resolvedByMonthData}
                    />
                  </Card>
                  <Card>
                    <SimpleBarChart
                      title={t('charts.avgResolutionByMonth')}
                      data={avgResolutionByMonthData}
                    />
                  </Card>
                </div>
              </>
            ) : (
              <div className="mt-6 p-4 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                {t('charts.trendsUnavailable')}
              </div>
            )}

            {/* Difficulté Agent (Triage N1) */}
            {difficulty ? (
              <>
                <div className="mt-6 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('agentDifficulty.title')}
                  </h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card>
                    <PieChart
                      title={t('agentDifficulty.n1Decisions')}
                      data={n1PieData}
                      size={160}
                    />
                  </Card>
                  <Card>
                    <StatsCard
                      title={t('agentDifficulty.escalationRate')}
                      value={`${difficulty.escalationRate.toFixed(1)}%`}
                      icon={AlertTriangle}
                      subtitle={t('agentDifficulty.escalationSubtitle')}
                      variant="danger"
                    />
                  </Card>
                  <Card>
                    <SimpleBarChart
                      title={t('agentDifficulty.avgResolutionBySeverity')}
                      data={avgResolutionBySeverityData}
                    />
                  </Card>
                </div>
              </>
            ) : (
              <div className="mt-6 p-4 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                {t('charts.difficultyUnavailable')}
              </div>
            )}

            {/* Refresh Button */}
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={fetchStats}>
                🔄 {t('refresh')}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
