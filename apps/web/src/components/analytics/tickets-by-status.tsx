'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

const data = [
  { name: 'Open', value: 45, color: 'hsl(var(--primary))' },
  { name: 'In Progress', value: 32, color: 'hsl(var(--warning))' },
  { name: 'Resolved', value: 156, color: 'hsl(var(--success))' },
  { name: 'Closed', value: 89, color: 'hsl(var(--muted))' },
];

export function TicketsByStatus() {
  // TODO: Replace with actual API call
  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {!hasData ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={BarChart3}
                title="No data available"
                description="Analytics will appear here once you start receiving tickets."
              />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
