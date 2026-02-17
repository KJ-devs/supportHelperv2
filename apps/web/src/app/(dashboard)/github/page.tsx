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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">GitHub Integration</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Sync and manage GitHub issues and repositories.</p>
        </div>
        <Button variant="outline" className="min-h-[44px] self-start sm:self-auto">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Now
        </Button>
      </div>

      <GitHubSyncStatus />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <GitHubRepositories />
        <GitHubIssues />
      </div>
    </div>
  );
}
