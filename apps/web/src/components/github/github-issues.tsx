'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatRelativeTime } from '@/lib/utils';
import { ExternalLink, GitBranch, FileText } from 'lucide-react';

const issues = [
  {
    id: '456',
    number: 123,
    title: 'Fix authentication flow on mobile devices',
    repository: 'support-helper/backend',
    state: 'open',
    linkedTicket: '1234',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '457',
    number: 124,
    title: 'Add dark mode support',
    repository: 'support-helper/frontend',
    state: 'open',
    linkedTicket: '1232',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: '458',
    number: 125,
    title: 'API rate limiting improvements',
    repository: 'support-helper/backend',
    state: 'closed',
    linkedTicket: '1230',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
];

export function GitHubIssues() {
  // TODO: Replace with actual API call to check if GitHub is connected
  const isGitHubConnected = issues.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Issues</CardTitle>
      </CardHeader>
      <CardContent>
        {!isGitHubConnected ? (
          <EmptyState
            icon={GitBranch}
            title="No GitHub connection"
            description="Connect your GitHub repository to sync and manage issues."
            action={{
              label: 'Connect GitHub',
              onClick: () => {
                // TODO: Navigate to GitHub connection page
                console.log('Navigate to GitHub OAuth');
              },
            }}
          />
        ) : (
          <div className="space-y-4">
            {issues.map(issue => (
              <div key={issue.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">#{issue.number}</p>
                    <p className="text-sm">{issue.title}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{issue.repository}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(issue.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={issue.state === 'open' ? 'default' : 'secondary'}>
                    {issue.state}
                  </Badge>
                  <Link
                    href={`/tickets/${issue.linkedTicket}`}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Ticket #{issue.linkedTicket}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
