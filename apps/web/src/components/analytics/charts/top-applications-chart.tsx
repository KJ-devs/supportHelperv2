'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AppWindow } from 'lucide-react';
import type { TopApplicationData } from '@/types/analytics';

interface TopApplicationsChartProps {
  data?: TopApplicationData[];
  isLoading?: boolean;
}

export function TopApplicationsChart({ data, isLoading }: TopApplicationsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Applications by Tickets</CardTitle>
          <CardDescription>Applications generating the most support tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Take only top 5
  const topFive = data?.slice(0, 5);
  const isEmpty = !topFive || topFive.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Applications by Tickets</CardTitle>
        <CardDescription>Applications generating the most support tickets</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={AppWindow}
            title="No data available"
            description="There are no applications with tickets in the selected date range."
            className="min-h-[200px]"
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topFive}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted"
                horizontal={true}
                vertical={false}
              />
              <XAxis
                type="number"
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                dataKey="applicationName"
                type="category"
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [value, 'Tickets']}
              />
              <Bar dataKey="ticketCount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
