'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PieChartIcon } from 'lucide-react';
import type { TicketsBySeverityData } from '@/types/analytics';

interface TicketsBySeverityChartProps {
  data?: TicketsBySeverityData[];
  total?: number;
  isLoading?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

const RADIAN = Math.PI / 180;

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: CustomLabelProps) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function TicketsBySeverityChart({ data, total, isLoading }: TicketsBySeverityChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tickets by Severity</CardTitle>
          <CardDescription>Distribution by priority level</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formattedData = data?.map(item => ({
    ...item,
    displaySeverity: item.severity.charAt(0).toUpperCase() + item.severity.slice(1),
  }));

  const isEmpty = !data || data.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by Severity</CardTitle>
        <CardDescription>
          Distribution by priority level {total ? `(${total} total)` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={PieChartIcon}
            title="No data available"
            description="There are no tickets in the selected date range."
            className="min-h-[200px]"
          />
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="displaySeverity"
              >
                {formattedData?.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={SEVERITY_COLORS[entry.severity] || entry.color}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number, name: string) => [value, name]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={value => <span className="text-sm text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
