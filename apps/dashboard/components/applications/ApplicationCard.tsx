/**
 * Application Card Component
 * Carte affichant une application avec son SDK key
 */

'use client';

import { useState } from 'react';
import type { Application } from '@/lib/types/application';
import { Badge, Button } from '@/components/ui';

interface ApplicationCardProps {
  application: Application;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
  onRegenerateKey: (app: Application) => void;
}

export function ApplicationCard({
  application,
  onEdit,
  onDelete,
  onRegenerateKey,
}: ApplicationCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(application.sdkKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createdAt = new Date(application.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const ticketCount = application._count?.tickets || 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-gray-800/20 border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate mb-1">
            {application.name}
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="default">
              {application.platform === 'web' && '🌐 Web'}
              {application.platform === 'mobile' && '📱 Mobile'}
              {application.platform === 'desktop' && '💻 Desktop'}
              {!['web', 'mobile', 'desktop'].includes(application.platform) && application.platform}
            </Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">{createdAt}</span>
          </div>
        </div>
      </div>

      {/* SDK Key */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SDK Key
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
            {showKey ? application.sdkKey : '••••••••••••••••••••••••••••'}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowKey(!showKey)}
            title={showKey ? 'Masquer' : 'Afficher'}
          >
            {showKey ? '👁️' : '🔒'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyKey}
            title="Copier"
          >
            {copied ? '✅' : '📋'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">Tickets créés</span>
          <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {ticketCount}
          </span>
        </div>
      </div>

      {/* Settings Preview */}
      {application.settings && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex flex-wrap gap-2">
            {application.settings.recordVideo && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">🎥 Vidéo</span>
            )}
            {application.settings.captureLogs && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">📝 Logs</span>
            )}
            {application.settings.autoAssign && (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">🤖 Auto-assign</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t dark:border-gray-700">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onEdit(application)}
          className="flex-1"
        >
          ✏️ Modifier
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRegenerateKey(application)}
          title="Régénérer la clé"
        >
          🔄
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => onDelete(application)}
          title="Supprimer"
        >
          🗑️
        </Button>
      </div>
    </div>
  );
}
