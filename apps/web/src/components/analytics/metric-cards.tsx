'use client';

import { TrendingUp, TrendingDown, Minus, Ticket, Clock, Brain, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalyticsMetrics } from '@/types/analytics';

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  suffix?: string;
  prefix?: string;
  changeLabel?: string;
  invertTrend?: boolean; // For metrics where lower is better (like resolution time)
}

function MetricCard({
  title,
  value,
  change,
  icon,
  suffix,
  prefix,
  changeLabel = 'vs last period',
  invertTrend = false,
}: MetricCardProps) {
  const isPositive = invertTrend ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 0.5;

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const trendColor = isNeutral
    ? 'text-muted-foreground'
    : isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  const formattedChange = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {prefix}
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix}
        </div>
        <div className={`flex items-center text-xs ${trendColor}`}>
          <TrendIcon className="mr-1 h-3 w-3" />
          {formattedChange} {changeLabel}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

interface AnalyticsMetricCardsProps {
  metrics?: AnalyticsMetrics;
  isLoading?: boolean;
}

export function AnalyticsMetricCards({ metrics, isLoading }: AnalyticsMetricCardsProps) {
  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  const formatResolutionTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    return `${(hours / 24).toFixed(1)}d`;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Tickets (Month)"
        value={metrics.totalTickets}
        change={metrics.totalTicketsChange}
        icon={<Ticket className="h-4 w-4" />}
      />
      <MetricCard
        title="Avg. Resolution Time"
        value={formatResolutionTime(metrics.avgResolutionTime)}
        change={metrics.avgResolutionTimeChange}
        icon={<Clock className="h-4 w-4" />}
        invertTrend={true}
      />
      <MetricCard
        title="AI Accuracy"
        value={metrics.aiAccuracy.toFixed(1)}
        change={metrics.aiAccuracyChange}
        suffix="%"
        icon={<Brain className="h-4 w-4" />}
      />
      <MetricCard
        title="Active Users"
        value={metrics.activeUsers}
        change={metrics.activeUsersChange}
        icon={<Users className="h-4 w-4" />}
      />
    </div>
  );
}

export { MetricCard, MetricCardSkeleton };
