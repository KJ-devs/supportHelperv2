'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const notifications = [
  {
    id: 'new-tickets',
    title: 'New Tickets',
    description: 'Get notified when a new ticket is created',
    defaultChecked: true,
  },
  {
    id: 'ticket-updates',
    title: 'Ticket Updates',
    description: 'Get notified when tickets are updated',
    defaultChecked: true,
  },
  {
    id: 'assignments',
    title: 'Assignments',
    description: 'Get notified when a ticket is assigned to you',
    defaultChecked: true,
  },
  {
    id: 'mentions',
    title: 'Mentions',
    description: 'Get notified when you are mentioned',
    defaultChecked: true,
  },
  {
    id: 'daily-summary',
    title: 'Daily Summary',
    description: 'Receive a daily summary of activity',
    defaultChecked: false,
  },
];

export function NotificationSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose what notifications you want to receive.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {notifications.map(notification => (
            <div key={notification.id} className="flex items-center justify-between space-x-4">
              <div className="space-y-0.5">
                <Label htmlFor={notification.id}>{notification.title}</Label>
                <p className="text-sm text-muted-foreground">{notification.description}</p>
              </div>
              <Switch id={notification.id} defaultChecked={notification.defaultChecked} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
