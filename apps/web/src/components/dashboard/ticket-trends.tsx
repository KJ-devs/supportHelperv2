'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const data = [
  { name: 'Mon', tickets: 24, resolved: 20 },
  { name: 'Tue', tickets: 30, resolved: 28 },
  { name: 'Wed', tickets: 28, resolved: 25 },
  { name: 'Thu', tickets: 35, resolved: 32 },
  { name: 'Fri', tickets: 42, resolved: 38 },
  { name: 'Sat', tickets: 18, resolved: 16 },
  { name: 'Sun', tickets: 12, resolved: 11 },
];

export function TicketTrends() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket Trends (Last 7 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
              <YAxis className="text-xs fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="tickets"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="New Tickets"
              />
              <Line
                type="monotone"
                dataKey="resolved"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                name="Resolved"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
