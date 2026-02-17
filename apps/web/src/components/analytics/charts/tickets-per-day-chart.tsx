'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3, TrendingUp } from 'lucide-react';
import type { TicketsPerDayData } from '@/types/analytics';
import { format, parseISO } from 'date-fns';

interface TicketsPerDayChartProps {
  data?: TicketsPerDayData[];
  isLoading?: boolean;
}

export function TicketsPerDayChart({ data, isLoading }: TicketsPerDayChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets Created Per Day</CardTitle>
          <CardDescription>Daily ticket volume over the selected period</CardDescription>
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
  }));

  const hasData = data && data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets Created Per Day</CardTitle>
        <CardDescription>Daily ticket volume over the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {!hasData ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={TrendingUp}
                title="No data available"
                description="Analytics will appear here once you start receiving tickets."
              />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="formattedDate"
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tickets"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  name="Tickets"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
