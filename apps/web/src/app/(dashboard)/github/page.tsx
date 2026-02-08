import { type Metadata } from 'next';
import { GitHubSyncStatus } from '@/components/github/github-sync-status';
import { GitHubRepositories } from '@/components/github/github-repositories';
import { GitHubIssues } from '@/components/github/github-issues';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'GitHub Integration',
  description: 'Manage GitHub synchronization',
};

export default function GitHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GitHub Integration</h1>
          <p className="text-muted-foreground">Sync and manage GitHub issues and repositories.</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Now
        </Button>
      </div>

      <GitHubSyncStatus />

      <div className="grid gap-6 lg:grid-cols-2">
        <GitHubRepositories />
        <GitHubIssues />
      </div>
    </div>
  );
}
