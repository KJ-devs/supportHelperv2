/**
 * Analytics Page
 * Page des statistiques et métriques
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import type { TicketStats } from '@/lib/types/ticket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/analytics/StatsCard';
import { SimpleBarChart } from '@/components/analytics/SimpleBarChart';
import { PieChart } from '@/components/analytics/PieChart';
import { PageLoader, Card, Button, Select, EmptyState } from '@/components/ui';
import { AlertTriangle, Ticket, ClipboardList, CheckCircle, BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [stats, setStats] = useState<TicketStats | null>(null);
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
        'all': 'month',
      };
      const period = periodMap[timeRange] || 'week';

      // Get ticket stats with period filter
      const ticketStats = await ticketsApi.getStats(period);
      setStats(ticketStats);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des statistiques');
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

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
            <div className="text-red-600 dark:text-red-400 text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Erreur</h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error || 'Données non disponibles'}</p>
            <Button variant="secondary" onClick={fetchStats}>
              Réessayer
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Prepare chart data
  const statusData = [
    { label: 'Nouveau', value: stats.byStatus.new || 0, color: '#3b82f6' },
    { label: 'Ouvert', value: stats.byStatus.open || 0, color: '#f59e0b' },
    { label: 'En cours', value: stats.byStatus.in_progress || 0, color: '#8b5cf6' },
    { label: 'Résolu', value: stats.byStatus.resolved || 0, color: '#10b981' },
    { label: 'Fermé', value: stats.byStatus.closed || 0, color: '#6b7280' },
  ];

  const severityData = [
    { label: 'Critique', value: stats.bySeverity.critical || 0, color: '#dc2626' },
    { label: 'Élevée', value: stats.bySeverity.high || 0, color: '#f59e0b' },
    { label: 'Moyenne', value: stats.bySeverity.medium || 0, color: '#3b82f6' },
    { label: 'Faible', value: stats.bySeverity.low || 0, color: '#10b981' },
  ];

  const typeData = [
    { label: 'Bug', value: stats.byType.bug || 0, color: '#dc2626' },
    { label: 'Crash', value: stats.byType.crash || 0, color: '#f59e0b' },
    { label: 'Performance', value: stats.byType.performance || 0, color: '#8b5cf6' },
    { label: 'Interface', value: stats.byType.ui || 0, color: '#3b82f6' },
    { label: 'Fonctionnalité', value: stats.byType.feature_request || 0, color: '#10b981' },
    { label: 'Autre', value: stats.byType.other || 0, color: '#6b7280' },
  ];

  const openTickets = (stats.byStatus.new || 0) + (stats.byStatus.open || 0) + (stats.byStatus.in_progress || 0);
  const resolvedTickets = (stats.byStatus.resolved || 0) + (stats.byStatus.closed || 0);
  const resolutionRate = stats.total > 0 ? ((resolvedTickets / stats.total) * 100).toFixed(1) : '0';

  const hasNoData = stats.total === 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Analytiques</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Statistiques et métriques de vos tickets
              </p>
            </div>

            {/* Time Range Selector */}
            {!hasNoData && (
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                options={[
                  { value: '7d', label: '7 derniers jours' },
                  { value: '30d', label: '30 derniers jours' },
                  { value: '90d', label: '90 derniers jours' },
                  { value: 'all', label: 'Tout' },
                ]}
              />
            )}
          </div>
        </div>

        {/* Empty State */}
        {hasNoData && (
          <EmptyState
            icon="📊"
            title="Pas encore de données"
            description="Les statistiques s'afficheront dès que vous recevrez vos premiers tickets. Créez une application et intégrez le SDK pour commencer."
            actionLabel="Créer une application"
            actionHref="/dashboard/applications"
            variant="bordered"
          />
        )}

        {/* Key Metrics */}
        {!hasNoData && (<>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatsCard
            title="Total Tickets"
            value={stats.total}
            icon={Ticket}
            subtitle="Tous les tickets"
            variant="primary"
          />

          <StatsCard
            title="Tickets Ouverts"
            value={openTickets}
            icon={ClipboardList}
            subtitle="New + Open + In Progress"
            variant="warning"
          />

          <StatsCard
            title="Tickets Résolus"
            value={resolvedTickets}
            icon={CheckCircle}
            subtitle="Resolved + Closed"
            variant="success"
          />

          <StatsCard
            title="Taux de Résolution"
            value={`${resolutionRate}%`}
            icon={BarChart3}
            subtitle="Résolus / Total"
            variant="default"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Status Distribution */}
          <Card>
            <SimpleBarChart
              title="Distribution par Statut"
              data={statusData}
            />
          </Card>

          {/* Severity Distribution */}
          <Card>
            <PieChart
              title="Distribution par Sévérité"
              data={severityData}
              size={180}
            />
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          <Card>
            <SimpleBarChart
              title="Distribution par Type"
              data={typeData}
            />
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🔴 Tickets Critiques
            </h3>
            <p className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
              {stats.bySeverity.critical || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Nécessitent une attention immédiate
            </p>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🐛 Bugs Rapportés
            </h3>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {stats.byType.bug || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total des bugs signalés
            </p>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              💥 Crashes
            </h3>
            <p className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
              {stats.byType.crash || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Applications crashées
            </p>
          </Card>
        </div>

        {/* Refresh Button */}
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={fetchStats}>
            🔄 Actualiser les données
          </Button>
        </div>
        </>)}
      </div>
    </DashboardLayout>
  );
}
