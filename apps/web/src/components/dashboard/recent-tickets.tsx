'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

const recentTickets = [
  {
    id: '1234',
    title: 'Cannot access dashboard after login',
    status: 'open',
    priority: 'high',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    customer: 'John Doe',
  },
  {
    id: '1233',
    title: 'Payment processing error on checkout',
    status: 'in_progress',
    priority: 'urgent',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    customer: 'Jane Smith',
  },
  {
    id: '1232',
    title: 'Feature request: Dark mode support',
    status: 'open',
    priority: 'low',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    customer: 'Bob Wilson',
  },
  {
    id: '1231',
    title: 'Mobile app crashes on startup',
    status: 'resolved',
    priority: 'high',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    customer: 'Alice Brown',
  },
  {
    id: '1230',
    title: 'API rate limiting too aggressive',
    status: 'in_progress',
    priority: 'medium',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    customer: 'Charlie Davis',
  },
];

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  open: 'default',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'secondary',
};

const priorityVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'warning'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  urgent: 'destructive',
};

export function RecentTickets() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Tickets</CardTitle>
        <Link href="/tickets" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTickets.map(ticket => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  #{ticket.id} - {ticket.title}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{ticket.customer}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(ticket.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={priorityVariants[ticket.priority]}>{ticket.priority}</Badge>
                <Badge variant={statusVariants[ticket.status]}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
