'use client';

import { Ticket, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const stats = [
  {
    name: 'Total Tickets',
    value: '1,234',
    change: '+12%',
    changeType: 'positive',
    icon: Ticket,
  },
  {
    name: 'Open Tickets',
    value: '45',
    change: '-5%',
    changeType: 'positive',
    icon: AlertCircle,
  },
  {
    name: 'Avg. Response Time',
    value: '2.4h',
    change: '-18%',
    changeType: 'positive',
    icon: Clock,
  },
  {
    name: 'Resolution Rate',
    value: '94%',
    change: '+3%',
    changeType: 'positive',
    icon: CheckCircle,
  },
];

export function OverviewCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map(stat => (
        <Card key={stat.name}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p
              className={`text-xs ${
                stat.changeType === 'positive'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {stat.change} from last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
