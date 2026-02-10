'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateTime } from '@/lib/utils';

interface TicketDetailProps {
  ticketId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

// Mock data - would come from API
const mockTicket = {
  id: '1234',
  title: 'Cannot access dashboard after login',
  description: `After logging in successfully, I am redirected to the dashboard but see a blank white page. 
  
The console shows a 403 error when trying to fetch user permissions. This started happening after the latest update.

Steps to reproduce:
1. Go to login page
2. Enter valid credentials
3. Click login
4. Observe blank dashboard

Expected: Dashboard should load with my data
Actual: Blank page with console errors`,
  status: 'open',
  priority: 'high',
  category: 'Bug',
  customer: {
    name: 'John Doe',
    email: 'john@example.com',
    avatar: null,
  },
  assignee: {
    name: 'Alice Johnson',
    email: 'alice@support.com',
    avatar: null,
  },
  createdAt: new Date(Date.now() - 30 * 60 * 1000),
  updatedAt: new Date(Date.now() - 10 * 60 * 1000),
  tags: ['authentication', 'dashboard', 'critical'],
};

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

export function TicketDetail({ ticketId: _ticketId }: TicketDetailProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{mockTicket.title}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Created {formatDateTime(mockTicket.createdAt)}</span>
              <span>•</span>
              <span>Updated {formatDateTime(mockTicket.updatedAt)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={priorityVariants[mockTicket.priority]}>{mockTicket.priority}</Badge>
            <Badge variant={statusVariants[mockTicket.status]}>
              {mockTicket.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Description */}
        <div className="space-y-2">
          <h4 className="font-medium">Description</h4>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {mockTicket.description}
          </p>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <h4 className="font-medium">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {mockTicket.tags.map(tag => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* People */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h4 className="font-medium">Customer</h4>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={mockTicket.customer.avatar || undefined} />
                <AvatarFallback>
                  {mockTicket.customer.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{mockTicket.customer.name}</p>
                <p className="text-xs text-muted-foreground">{mockTicket.customer.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Assignee</h4>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={mockTicket.assignee.avatar || undefined} />
                <AvatarFallback>
                  {mockTicket.assignee.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{mockTicket.assignee.name}</p>
                <p className="text-xs text-muted-foreground">{mockTicket.assignee.email}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
