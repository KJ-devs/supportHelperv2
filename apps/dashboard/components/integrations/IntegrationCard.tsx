'use client';

import { Integration } from '@/lib/types/integration';
import { Button, Card } from '@/components/ui';

interface IntegrationCardProps {
  integration: Integration;
  onEdit: (integration: Integration) => void;
  onDelete: (integration: Integration) => void;
  onTest: (integration: Integration) => void;
  onSync: (integration: Integration) => void;
  onViewLogs: (integration: Integration) => void;
}

const INTEGRATION_ICONS: Record<string, string> = {
  slack: '💬',
  discord: '🎮',
  notion: '📝',
  hubspot: '🎯',
  linear: '📐',
  jira: '🔵',
  zendesk: '💼',
  github: '🐙',
};

export function IntegrationCard({
  integration,
  onEdit,
  onDelete,
  onTest,
  onSync,
  onViewLogs,
}: IntegrationCardProps) {
  const icon = INTEGRATION_ICONS[integration.type] || '🔌';

  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <Card padding>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {integration.name}
            </h3>
            <p className="text-sm text-gray-500 capitalize">
              {integration.type}
            </p>
          </div>
        </div>
        <div>
          {integration.enabled ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Enabled
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Disabled
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Last synced:</span>
          <span className="text-gray-900 font-medium">
            {formatDate(integration.lastSyncedAt)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total syncs:</span>
          <span className="text-gray-900 font-medium">
            {integration._count?.syncLogs || 0}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Created:</span>
          <span className="text-gray-900 font-medium">
            {formatDate(integration.createdAt)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onTest(integration)}
        >
          🔍 Test
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onSync(integration)}
        >
          🔄 Sync
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onViewLogs(integration)}
        >
          📊 Logs
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onEdit(integration)}>
          ✏️ Edit
        </Button>
        <Button size="sm" variant="danger" onClick={() => onDelete(integration)}>
          🗑️ Delete
        </Button>
      </div>
    </Card>
  );
}
