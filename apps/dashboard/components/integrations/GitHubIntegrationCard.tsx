'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Github, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { githubApi, type GitHubConnectionStatus } from '@/lib/api/github';

/**
 * GitHub entry point on the Integrations page. GitHub used to have its own
 * sidebar item; it now lives here next to the other integrations.
 */
export function GitHubIntegrationCard() {
  const t = useTranslations('integrations.github');
  const [status, setStatus] = useState<GitHubConnectionStatus | null>(null);

  useEffect(() => {
    githubApi
      .getConnectionStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));
  }, []);

  return (
    <div className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gray-900 dark:bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Github className="w-5 h-5 text-white dark:text-gray-900" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">GitHub</h2>
              {status && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    status.connected
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {status.connected ? t('connected') : t('notConnected')}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/github"
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('repositories')}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href="/dashboard/settings/github"
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('configure')}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
