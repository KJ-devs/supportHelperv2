'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Badge, Loader } from '@/components/ui';
import {
  githubApi,
  type GitHubInstallation,
  type GitHubInstallationRepo,
  type GitHubAppConfig,
} from '@/lib/api/github';
import type { Application } from '@/lib/types/application';

interface RepoSelectorProps {
  installations: GitHubInstallation[];
  applications: Application[];
  onRepoLinked: () => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

export function RepoSelector({
  installations,
  applications,
  onRepoLinked,
  onToast,
}: RepoSelectorProps) {
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(
    installations.length > 0 ? installations[0]!.installationId : null
  );
  const [repos, setRepos] = useState<GitHubInstallationRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [selectedAppId, setSelectedAppId] = useState<string>(
    applications.length > 0 ? applications[0]!.id : ''
  );

  // Per-application GitHub config
  const [appConfigs, setAppConfigs] = useState<Record<string, GitHubAppConfig>>({});
  const [configLoading, setConfigLoading] = useState(false);

  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const fetchRepos = useCallback(
    async (installationId: number, pageNum: number) => {
      try {
        setReposLoading(true);
        const data = await githubApi.getInstallationRepos(installationId, pageNum);
        if (pageNum === 1) {
          setRepos(data.repositories || []);
        } else {
          setRepos((prev) => [...prev, ...(data.repositories || [])]);
        }
        setHasMore(data.hasMore ?? false);
      } catch (err: any) {
        onToast('error', err.message || 'Failed to load repositories');
      } finally {
        setReposLoading(false);
      }
    },
    [onToast]
  );

  // Load repos when installation changes
  useEffect(() => {
    if (selectedInstallationId) {
      setPage(1);
      fetchRepos(selectedInstallationId, 1);
    }
  }, [selectedInstallationId, fetchRepos]);

  // Load configs for all apps
  useEffect(() => {
    async function loadConfigs() {
      setConfigLoading(true);
      const configs: Record<string, GitHubAppConfig> = {};
      for (const app of applications) {
        try {
          const config = await githubApi.getGithubConfig(app.id);
          configs[app.id] = config;
        } catch {
          // No config yet
        }
      }
      setAppConfigs(configs);
      setConfigLoading(false);
    }
    if (applications.length > 0) {
      loadConfigs();
    }
  }, [applications]);

  const handleLoadMore = () => {
    if (selectedInstallationId) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchRepos(selectedInstallationId, nextPage);
    }
  };

  const handleLink = async (repo: GitHubInstallationRepo) => {
    if (!selectedAppId || !selectedInstallationId) return;
    try {
      setIsLinking(true);
      const [owner, repoName] = repo.fullName.split('/');
      await githubApi.connectRepo(selectedAppId, {
        installationId: selectedInstallationId,
        owner: owner!,
        repo: repoName!,
        defaultBranch: repo.defaultBranch,
      });
      onToast('success', `Linked ${repo.fullName} to application`);
      // Refresh configs
      const config = await githubApi.getGithubConfig(selectedAppId);
      setAppConfigs((prev) => ({ ...prev, [selectedAppId]: config }));
      onRepoLinked();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to link repository');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (appId: string) => {
    try {
      setIsUnlinking(true);
      await githubApi.disconnectRepo(appId);
      onToast('success', 'Repository unlinked');
      setAppConfigs((prev) => {
        const updated = { ...prev };
        delete updated[appId];
        return updated;
      });
      onRepoLinked();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to unlink repository');
    } finally {
      setIsUnlinking(false);
    }
  };

  const currentConfig = selectedAppId ? appConfigs[selectedAppId] : undefined;
  const isCurrentAppLinked = currentConfig?.repo && currentConfig?.owner;

  if (installations.length === 0) {
    return (
      <Card className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          Install the GitHub App first to browse repositories.
        </p>
      </Card>
    );
  }

  if (applications.length === 0) {
    return (
      <Card className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          Create an application first to link a repository.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Application + Installation selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Application
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.platform})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Installation
          </label>
          <select
            value={selectedInstallationId ?? ''}
            onChange={(e) => setSelectedInstallationId(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {installations.map((inst) => (
              <option key={inst.id} value={inst.installationId}>
                {inst.accountLogin} ({inst.accountType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Currently linked repo */}
      {configLoading ? (
        <Card>
          <div className="flex items-center justify-center py-4">
            <Loader size="sm" text="Loading configuration..." />
          </div>
        </Card>
      ) : isCurrentAppLinked ? (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {currentConfig!.owner}/{currentConfig!.repo}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Branch: {currentConfig!.defaultBranch || 'main'}
                </p>
              </div>
              <Badge variant="success">Linked</Badge>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleUnlink(selectedAppId)}
              isLoading={isUnlinking}
            >
              Unlink
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No repository linked to this application. Select one below.
          </p>
        </Card>
      )}

      {/* Repository list */}
      {!isCurrentAppLinked && (
        <>
          {reposLoading && repos.length === 0 ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <Loader size="sm" text="Loading repositories..." />
              </div>
            </Card>
          ) : repos.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No repositories found for this installation.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {repo.fullName}
                        </span>
                        {repo.private && (
                          <Badge variant="default">Private</Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLink(repo)}
                    isLoading={isLinking}
                  >
                    Link
                  </Button>
                </div>
              ))}

              {hasMore && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    isLoading={reposLoading}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
