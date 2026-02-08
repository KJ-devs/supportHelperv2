'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const data = [
  { name: 'Jan', rate: 91 },
  { name: 'Feb', rate: 89 },
  { name: 'Mar', rate: 92 },
  { name: 'Apr', rate: 94 },
  { name: 'May', rate: 93 },
  { name: 'Jun', rate: 96 },
];

export function ResolutionRateChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolution Rate (%)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis domain={[80, 100]} className="text-xs fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar
                dataKey="rate"
                fill="hsl(var(--success))"
                radius={[4, 4, 0, 0]}
                name="Resolution Rate"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
