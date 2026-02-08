'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const categories = [
  { name: 'Technical Issues', count: 423, percentage: 35 },
  { name: 'Billing & Payments', count: 289, percentage: 24 },
  { name: 'Feature Requests', count: 198, percentage: 16 },
  { name: 'Account Management', count: 156, percentage: 13 },
  { name: 'Other', count: 145, percentage: 12 },
];

export function TopCategories() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories.map(category => (
            <div key={category.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{category.name}</span>
                <span className="text-muted-foreground">
                  {category.count} ({category.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${category.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
