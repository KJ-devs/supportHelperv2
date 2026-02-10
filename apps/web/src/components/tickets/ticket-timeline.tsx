'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';
import { MessageSquare, UserPlus, Tag, CheckCircle } from 'lucide-react';

interface TicketTimelineProps {
  ticketId: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

// Mock timeline data
const timelineEvents = [
  {
    id: '1',
    type: 'created',
    user: { name: 'John Doe', avatar: null },
    message: 'Created this ticket',
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: '2',
    type: 'assigned',
    user: { name: 'System', avatar: null },
    message: 'Assigned to Alice Johnson',
    createdAt: new Date(Date.now() - 25 * 60 * 1000),
  },
  {
    id: '3',
    type: 'comment',
    user: { name: 'Alice Johnson', avatar: null },
    message: 'Looking into this issue now. Can you provide your browser version?',
    createdAt: new Date(Date.now() - 20 * 60 * 1000),
  },
  {
    id: '4',
    type: 'comment',
    user: { name: 'John Doe', avatar: null },
    message: 'Chrome 120.0.6099.109 on macOS Sonoma 14.2',
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: '5',
    type: 'tag',
    user: { name: 'Alice Johnson', avatar: null },
    message: 'Added tags: authentication, dashboard',
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
  },
];

const eventIcons: Record<string, typeof MessageSquare> = {
  created: CheckCircle,
  assigned: UserPlus,
  comment: MessageSquare,
  tag: Tag,
};

export function TicketTimeline({ ticketId: _ticketId }: TicketTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {timelineEvents.map((event, index) => {
            const Icon = eventIcons[event.type] || MessageSquare;
            return (
              <div key={event.id} className="flex gap-3">
                <div className="relative flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {index < timelineEvents.length - 1 && (
                    <div className="flex-1 w-px bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={event.user.avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {event.user.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{event.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
