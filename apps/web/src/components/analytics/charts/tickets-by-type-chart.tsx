'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TicketsByTypeData } from '@/types/analytics';

interface TicketsByTypeChartProps {
  data?: TicketsByTypeData[];
  isLoading?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  bug: '#ef4444',
  feature: '#3b82f6',
  ui: '#8b5cf6',
  performance: '#f59e0b',
  security: '#dc2626',
  documentation: '#10b981',
  other: '#6b7280',
};

export function TicketsByTypeChart({ data, isLoading }: TicketsByTypeChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets by Type</CardTitle>
          <CardDescription>Distribution of tickets by category</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formattedData = data?.map(item => ({
    ...item,
    displayType: item.type.charAt(0).toUpperCase() + item.type.slice(1),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by Type</CardTitle>
        <CardDescription>Distribution of tickets by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="displayType"
                className="text-xs fill-muted-foreground"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
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
                formatter={(value: number) => [value, 'Tickets']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {formattedData?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type] || entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
