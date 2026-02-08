'use client';

import { CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

const syncInfo = {
  status: 'healthy',
  lastSync: new Date(Date.now() - 5 * 60 * 1000),
  nextSync: new Date(Date.now() + 10 * 60 * 1000),
  issuesSynced: 234,
  repositoriesSynced: 12,
};

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    label: 'Healthy',
    variant: 'success' as const,
    color: 'text-green-600 dark:text-green-400',
  },
  syncing: {
    icon: RefreshCw,
    label: 'Syncing',
    variant: 'warning' as const,
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    variant: 'destructive' as const,
    color: 'text-red-600 dark:text-red-400',
  },
};

export function GitHubSyncStatus() {
  const config = statusConfig[syncInfo.status as keyof typeof statusConfig];
  const StatusIcon = config.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Sync Status</span>
          <Badge variant={config.variant}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Last Sync</p>
            <p className="font-medium">{formatRelativeTime(syncInfo.lastSync)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Next Sync</p>
            <p className="font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              in 10 minutes
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Issues Synced</p>
            <p className="font-medium">{syncInfo.issuesSynced}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Repositories</p>
            <p className="font-medium">{syncInfo.repositoriesSynced}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
