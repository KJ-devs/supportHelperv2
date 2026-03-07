'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Modal } from '@/components/ui';
import type { GitHubInstallation } from '@/lib/api/github';

interface GitHubAppInstallationsProps {
  installations: GitHubInstallation[];
  onRemove: (id: string) => Promise<void>;
  isRemoving: string | null;
}

export function GitHubAppInstallations({
  installations,
  onRemove,
  isRemoving,
}: GitHubAppInstallationsProps) {
  const t = useTranslations('githubInstallations');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  if (installations.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {installations.map(inst => (
          <div
            key={inst.id}
            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center space-x-4">
              {inst.accountAvatarUrl ? (
                <img
                  src={inst.accountAvatarUrl}
                  alt={inst.accountLogin}
                  className="w-10 h-10 rounded-lg"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {inst.accountLogin}
                  </span>
                  <Badge variant={inst.accountType === 'Organization' ? 'info' : 'default'}>
                    {inst.accountType}
                  </Badge>
                  <Badge variant="default">
                    {inst.repositorySelection === 'all' ? t('allRepos') : t('selectedRepos')}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('installed', {
                    date: new Date(inst.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }),
                  })}
                </p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmRemoveId(inst.id)}
              isLoading={isRemoving === inst.id}
            >
              {t('remove')}
            </Button>
          </div>
        ))}
      </div>

      <Modal
        isOpen={confirmRemoveId !== null}
        onClose={() => setConfirmRemoveId(null)}
        title={t('removeTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRemoveId(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirmRemoveId) {
                  await onRemove(confirmRemoveId);
                  setConfirmRemoveId(null);
                }
              }}
              isLoading={isRemoving === confirmRemoveId}
            >
              {t('remove')}
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">{t('removeMessage')}</p>
      </Modal>
    </>
  );
}
