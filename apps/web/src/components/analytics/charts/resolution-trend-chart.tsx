'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { TrendingUp } from 'lucide-react';
import type { ResolutionTrendData } from '@/types/analytics';
import { format, parseISO } from 'date-fns';

interface ResolutionTrendChartProps {
  data?: ResolutionTrendData[];
  isLoading?: boolean;
}

export function ResolutionTrendChart({ data, isLoading }: ResolutionTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Time to Resolution Trend</CardTitle>
          <CardDescription>Average resolution time over the period</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formattedData = data?.map(item => ({
    ...item,
    formattedDate: format(parseISO(item.date), 'MMM dd'),
    avgTimeFormatted: item.avgTime.toFixed(1),
  }));

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time to Resolution Trend</CardTitle>
        <CardDescription>Average resolution time in hours</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={TrendingUp}
            title="No data available"
            description="There are no resolved tickets in the selected date range."
            variant="compact"
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorResolution" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="formattedDate"
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={value => `${value}h`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value.toFixed(1)}h`, 'Avg. Resolution Time']}
              />
              <Area
                type="monotone"
                dataKey="avgTime"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorResolution)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
