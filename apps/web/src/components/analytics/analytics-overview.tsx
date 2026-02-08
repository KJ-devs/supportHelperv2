'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const metrics = [
  {
    name: 'Total Tickets',
    value: '2,847',
    change: '+12.5%',
    trend: 'up',
  },
  {
    name: 'Avg. Response Time',
    value: '1.8h',
    change: '-23%',
    trend: 'down',
  },
  {
    name: 'Resolution Rate',
    value: '94.2%',
    change: '+2.1%',
    trend: 'up',
  },
  {
    name: 'Customer Satisfaction',
    value: '4.7/5',
    change: '0%',
    trend: 'neutral',
  },
];

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendColors = {
  up: 'text-green-600 dark:text-green-400',
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-muted-foreground',
};

export function AnalyticsOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map(metric => {
        const TrendIcon = trendIcons[metric.trend as keyof typeof trendIcons];
        return (
          <Card key={metric.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div
                className={`flex items-center text-xs ${trendColors[metric.trend as keyof typeof trendColors]}`}
              >
                <TrendIcon className="mr-1 h-3 w-3" />
                {metric.change} from last period
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
