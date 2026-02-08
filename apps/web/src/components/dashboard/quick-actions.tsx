'use client';

import Link from 'next/link';
import { Plus, FileText, BarChart2, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const actions = [
  {
    name: 'New Ticket',
    description: 'Create a support ticket',
    href: '/tickets/new',
    icon: Plus,
  },
  {
    name: 'View Reports',
    description: 'Analytics and insights',
    href: '/analytics',
    icon: BarChart2,
  },
  {
    name: 'Documentation',
    description: 'Help and guides',
    href: '#',
    icon: FileText,
  },
  {
    name: 'Settings',
    description: 'Configure preferences',
    href: '/settings',
    icon: Settings,
  },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions.map(action => (
          <Link key={action.name} href={action.href}>
            <Button variant="outline" className="w-full justify-start h-auto py-3">
              <action.icon className="mr-3 h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">{action.name}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
