'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Badge } from '@/components/ui';
import { GitHubAppInstallations } from '@/components/github/GitHubAppInstallations';
import { RepoSelector } from '@/components/github/RepoSelector';
import {
  githubApi,
  type GitHubAppInfo,
  type GitHubInstallation,
} from '@/lib/api/github';
import { applicationsApi } from '@/lib/api/applications';
import type { Application } from '@/lib/types/application';

export default function GitHubSettingsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <GitHubSettingsContent />
    </Suspense>
  );
}

function GitHubSettingsContent() {
  const { isLoading: authLoading } = useRequireAuth();
  const searchParams = useSearchParams();

  // App info
  const [appInfo, setAppInfo] = useState<GitHubAppInfo | null>(null);
  const [appInfoLoading, setAppInfoLoading] = useState(true);
  const [appInfoError, setAppInfoError] = useState<string | null>(null);

  // Installations
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [installationsLoading, setInstallationsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Applications (for repo linking)
  const [applications, setApplications] = useState<Application[]>([]);

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

  // Handle callback params from GitHub App installation
  useEffect(() => {
    const githubApp = searchParams.get('github_app');
    const errorParam = searchParams.get('error');

    if (githubApp === 'installed') {
      showToast('success', 'GitHub App installed successfully');
      window.history.replaceState({}, '', '/dashboard/settings/github');
    } else if (errorParam) {
      showToast('error', `GitHub App installation failed: ${errorParam}`);
      window.history.replaceState({}, '', '/dashboard/settings/github');
    }
  }, [searchParams, showToast]);

  // Fetch app info
  const fetchAppInfo = useCallback(async () => {
    try {
      setAppInfoLoading(true);
      setAppInfoError(null);
      const info = await githubApi.getAppInfo();
      setAppInfo(info);
    } catch (err: any) {
      setAppInfoError(err.message || 'Failed to load GitHub App info');
    } finally {
      setAppInfoLoading(false);
    }
  }, []);

  // Fetch installations
  const fetchInstallations = useCallback(async () => {
    try {
      setInstallationsLoading(true);
      const data = await githubApi.getInstallations();
      setInstallations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch installations:', err);
      setInstallations([]);
    } finally {
      setInstallationsLoading(false);
    }
  }, []);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    try {
      const data = await applicationsApi.getApplications();
      setApplications(data || []);
    } catch {
      // Applications may not be loaded yet
    }
  }, []);

  // Initial data load
  useEffect(() => {
    if (!authLoading) {
      fetchAppInfo();
      fetchInstallations();
      fetchApplications();
    }
  }, [authLoading, fetchAppInfo, fetchInstallations, fetchApplications]);

  // Install GitHub App
  const handleInstall = async () => {
    try {
      if (appInfo?.installUrl) {
        window.location.href = appInfo.installUrl;
      } else {
        const data = await githubApi.getInstallUrl();
        window.location.href = data.url;
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to get install URL');
    }
  };

  // Remove installation
  const handleRemoveInstallation = async (id: string) => {
    try {
      setRemovingId(id);
      await githubApi.removeInstallation(id);
      setInstallations((prev) => prev.filter((i) => i.id !== id));
      showToast('success', 'Installation removed');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to remove installation');
    } finally {
      setRemovingId(null);
    }
  };

  if (authLoading) {
    return <PageLoader />;
  }

  const hasInstallations = installations.length > 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{toast.type === 'success' ? 'OK' : '!'}</span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <a
              href="/dashboard/settings"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Settings
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">
              GitHub
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            GitHub App Integration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Install the GitHub App to your organization or account, then link
            repositories to your applications for automatic issue creation and
            bidirectional sync.
          </p>
        </div>

        {/* Error State */}
        {appInfoError && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {appInfoError}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAppInfo}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Section 1: GitHub App Connection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Connection
          </h2>

          {appInfoLoading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                <span className="ml-3 text-sm text-gray-500">
                  Loading GitHub App info...
                </span>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {appInfo?.appName || 'GitHub App'}
                      </h3>
                      {hasInstallations ? (
                        <Badge variant="success">Installed</Badge>
                      ) : (
                        <Badge variant="warning">Not installed</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {hasInstallations
                        ? `${installations.length} installation(s) active`
                        : 'Install the GitHub App to connect your repositories'}
                    </p>
                  </div>
                </div>
                <Button onClick={handleInstall}>
                  {hasInstallations ? 'Add Installation' : 'Install GitHub App'}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Section 2: Installations */}
        {hasInstallations && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Installations
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchInstallations}
                isLoading={installationsLoading}
              >
                Refresh
              </Button>
            </div>

            {installationsLoading && installations.length === 0 ? (
              <Card>
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                  <span className="ml-3 text-sm text-gray-500">
                    Loading installations...
                  </span>
                </div>
              </Card>
            ) : (
              <GitHubAppInstallations
                installations={installations}
                onRemove={handleRemoveInstallation}
                isRemoving={removingId}
              />
            )}
          </div>
        )}

        {/* Section 3: Repository Linking */}
        {hasInstallations && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Link Repository to Application
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose an application and link a GitHub repository. Issues will be
              automatically created and synced for linked applications.
            </p>

            <RepoSelector
              installations={installations}
              applications={applications}
              onRepoLinked={() => {
                fetchApplications();
              }}
              onToast={showToast}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
