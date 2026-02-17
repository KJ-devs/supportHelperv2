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
import { Brain } from 'lucide-react';
import type { AIConfidenceData } from '@/types/analytics';
import { format, parseISO } from 'date-fns';

interface AIConfidenceChartProps {
  data?: AIConfidenceData[];
  isLoading?: boolean;
}

export function AIConfidenceChart({ data, isLoading }: AIConfidenceChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Confidence Scores</CardTitle>
          <CardDescription>Average AI prediction confidence over time</CardDescription>
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
    avgConfidenceFormatted: item.avgConfidence.toFixed(1),
  }));

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Confidence Scores</CardTitle>
        <CardDescription>Average AI prediction confidence over time</CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={Brain}
            title="No data available"
            description="There are no AI predictions in the selected date range."
            className="min-h-[200px]"
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="formattedDate"
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                domain={[0, 100]}
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={value => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  if (name === 'avgConfidence') return [`${value.toFixed(1)}%`, 'Confidence'];
                  return [value, 'Predictions'];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgConfidence"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Confidence %"
              />
              <Line
                type="monotone"
                dataKey="totalPredictions"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                name="Total Predictions"
                yAxisId={1}
              />
              <YAxis
                yAxisId={1}
                orientation="right"
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
