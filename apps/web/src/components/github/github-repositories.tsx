'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { GitFork, Star, AlertCircle, FolderGit2 } from 'lucide-react';

const repositories = [
  {
    id: '1',
    name: 'support-helper/backend',
    description: 'Main backend API service',
    openIssues: 12,
    stars: 234,
    synced: true,
  },
  {
    id: '2',
    name: 'support-helper/frontend',
    description: 'Customer-facing web application',
    openIssues: 8,
    stars: 189,
    synced: true,
  },
  {
    id: '3',
    name: 'support-helper/sdk',
    description: 'JavaScript SDK for integration',
    openIssues: 3,
    stars: 67,
    synced: true,
  },
  {
    id: '4',
    name: 'support-helper/docs',
    description: 'Documentation website',
    openIssues: 5,
    stars: 45,
    synced: false,
  },
];

export function GitHubRepositories() {
  // TODO: Replace with actual API call to check if GitHub is connected
  const hasRepositories = repositories.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Repositories</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRepositories ? (
          <EmptyState
            icon={FolderGit2}
            title="No repositories connected"
            description="Connect your GitHub account to sync repositories and issues."
            action={{
              label: 'Connect GitHub',
              onClick: () => {
                // TODO: Navigate to GitHub OAuth
                console.log('Navigate to GitHub OAuth');
              },
            }}
          />
        ) : (
          <div className="space-y-4">
            {repositories.map(repo => (
              <div key={repo.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <GitFork className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{repo.name}</p>
                    {repo.synced ? (
                      <Badge variant="success">Synced</Badge>
                    ) : (
                      <Badge variant="secondary">Not Synced</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{repo.description}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {repo.openIssues}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    {repo.stars}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
