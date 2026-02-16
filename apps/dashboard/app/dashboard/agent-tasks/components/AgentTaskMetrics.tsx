'use client';

import type { AgentTaskStats } from '@/lib/api/agent-tasks';

interface AgentTaskMetricsProps {
  stats: AgentTaskStats | null;
  isLoading: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accentColor: string;
  isLoading?: boolean;
}

function MetricCard({ title, value, subtitle, accentColor, isLoading }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-5 border-l-4" style={{ borderLeftColor: accentColor }}>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      {isLoading ? (
        <div className="mt-1 h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      )}
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

export function AgentTaskMetrics({ stats, isLoading }: AgentTaskMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <MetricCard
        title="Total Tasks"
        value={stats?.totalTasks ?? 0}
        accentColor="#3B82F6"
        isLoading={isLoading}
      />
      <MetricCard
        title="In Progress"
        value={stats?.inProgress ?? 0}
        accentColor="#F59E0B"
        isLoading={isLoading}
      />
      <MetricCard
        title="Success Rate"
        value={`${stats?.successRate ?? 0}%`}
        accentColor="#10B981"
        isLoading={isLoading}
      />
      <MetricCard
        title="Avg. Resolution"
        value={stats?.avgResolutionTime ? `${stats.avgResolutionTime}m` : 'N/A'}
        subtitle="minutes"
        accentColor="#8B5CF6"
        isLoading={isLoading}
      />
      <MetricCard
        title="Failed"
        value={stats?.failedCount ?? 0}
        accentColor="#EF4444"
        isLoading={isLoading}
      />
    </div>
  );
}
