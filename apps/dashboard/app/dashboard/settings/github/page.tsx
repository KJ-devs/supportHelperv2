'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Badge, Input, Select, useToast } from '@/components/ui';
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

  // Selected application for settings (independent from RepoSelector)
  const [selectedSettingsAppId, setSelectedSettingsAppId] = useState<string>('');
  const [appConfig, setAppConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Agent settings form state
  const [agentMode, setAgentMode] = useState<'auto' | 'review_plan' | 'review_all'>('auto');
  const [maxRetries, setMaxRetries] = useState(3);
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);
  const [savingAgent, setSavingAgent] = useState(false);

  // Merge settings form state
  const [autoMergeEnabled, setAutoMergeEnabled] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<'squash' | 'merge' | 'rebase'>('squash');
  const [requiredReviews, setRequiredReviews] = useState(1);
  const [savingMerge, setSavingMerge] = useState(false);

  // Toast
  const toast = useToast();

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      if (type === 'success') {
        toast.success(message);
      } else {
        toast.error(message);
      }
    },
    [toast]
  );

  // Validation errors for agent settings fields
  const [agentFieldErrors, setAgentFieldErrors] = useState<Record<string, string>>({});
  // Validation errors for merge settings fields
  const [mergeFieldErrors, setMergeFieldErrors] = useState<Record<string, string>>({});

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
      // Auto-select first linked app for settings
      if (data && data.length > 0) {
        const linkedApps = await Promise.all(
          data.map(async (app) => {
            try {
              const config = await githubApi.getGithubConfig(app.id);
              return config?.repo ? app.id : null;
            } catch {
              return null;
            }
          })
        );
        const firstLinked = linkedApps.find((id) => id !== null);
        if (firstLinked) {
          setSelectedSettingsAppId(firstLinked);
        }
      }
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

  // Install GitHub App — always use getInstallUrl() so the backend
  // adds the ?state={tenantId} parameter required for the callback mapping.
  const handleInstall = async () => {
    try {
      const data = await githubApi.getInstallUrl();
      window.location.href = data.url;
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

  // Sync installations from GitHub
  const handleSyncInstallations = async () => {
    try {
      setInstallationsLoading(true);
      const result = await githubApi.syncInstallations();
      if (result.synced > 0) {
        setInstallations(result.installations);
        showToast('success', `${result.synced} installation(s) synced from GitHub`);
      } else {
        showToast('success', 'Already up to date');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to sync installations');
    } finally {
      setInstallationsLoading(false);
      fetchInstallations();
    }
  };

  // Fetch config for selected settings app
  const fetchAppConfig = useCallback(async () => {
    if (!selectedSettingsAppId) {
      setAppConfig(null);
      return;
    }
    try {
      setConfigLoading(true);
      const config = await githubApi.getGithubConfig(selectedSettingsAppId);
      setAppConfig(config);

      // Load current settings into form state
      const settings = config?.settings || {};
      setAgentMode(settings.agentMode || 'auto');
      setMaxRetries(settings.maxRetries || 3);
      setTimeoutMinutes(settings.timeoutMinutes || 5);
      setAutoMergeEnabled(settings.autoMergeEnabled || false);
      setMergeStrategy(settings.mergeStrategy || 'squash');
      setRequiredReviews(settings.requiredReviews || 1);
      setAgentFieldErrors({});
      setMergeFieldErrors({});
    } catch (err: any) {
      console.error('Failed to fetch app config:', err);
      setAppConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, [selectedSettingsAppId]);

  // Load config when selected app changes
  useEffect(() => {
    fetchAppConfig();
  }, [fetchAppConfig]);

  // Validate a numeric field within a range
  const validateNumberField = (value: number, min: number, max: number, label: string): string => {
    if (!Number.isInteger(value) || value < min || value > max) {
      return `${label} doit être entre ${min} et ${max}`;
    }
    return '';
  };

  const getAgentFieldErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const retriesErr = validateNumberField(maxRetries, 1, 10, 'Max Retries');
    if (retriesErr) errors.maxRetries = retriesErr;
    const timeoutErr = validateNumberField(timeoutMinutes, 1, 30, 'Timeout');
    if (timeoutErr) errors.timeoutMinutes = timeoutErr;
    return errors;
  };

  const getMergeFieldErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const reviewsErr = validateNumberField(requiredReviews, 0, 5, 'Required Reviews');
    if (reviewsErr) errors.requiredReviews = reviewsErr;
    return errors;
  };

  const isAgentFormValid = Object.keys(getAgentFieldErrors()).length === 0;
  const isMergeFormValid = Object.keys(getMergeFieldErrors()).length === 0;

  // Save agent settings
  const handleSaveAgentSettings = async () => {
    if (!selectedSettingsAppId) return;
    const errors = getAgentFieldErrors();
    if (Object.keys(errors).length > 0) {
      setAgentFieldErrors(errors);
      return;
    }
    try {
      setSavingAgent(true);
      await githubApi.updateGithubSettings(selectedSettingsAppId, {
        agentMode,
        maxRetries,
        timeoutMinutes,
      });
      showToast('success', 'Agent settings saved');
      setAgentFieldErrors({});
      fetchAppConfig();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save agent settings');
    } finally {
      setSavingAgent(false);
    }
  };

  // Save merge settings
  const handleSaveMergeSettings = async () => {
    if (!selectedSettingsAppId) return;
    const errors = getMergeFieldErrors();
    if (Object.keys(errors).length > 0) {
      setMergeFieldErrors(errors);
      return;
    }
    try {
      setSavingMerge(true);
      await githubApi.updateGithubSettings(selectedSettingsAppId, {
        autoMergeEnabled,
        mergeStrategy,
        requiredReviews,
      });
      showToast('success', 'Merge settings saved');
      setMergeFieldErrors({});
      fetchAppConfig();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save merge settings');
    } finally {
      setSavingMerge(false);
    }
  };

  if (authLoading) {
    return <PageLoader />;
  }

  const hasInstallations = installations.length > 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSyncInstallations}
                    isLoading={installationsLoading}
                    title="Import existing GitHub App installations into the dashboard"
                  >
                    Sync from GitHub
                  </Button>
                  <Button onClick={handleInstall}>
                    {hasInstallations ? 'Add Installation' : 'Install GitHub App'}
                  </Button>
                </div>
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
                fetchAppConfig();
              }}
              onToast={showToast}
            />
          </div>
        )}

        {/* Section 4: Agent Settings */}
        {hasInstallations && applications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Agent Settings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure AI agent behavior for automated GitHub workflows.
            </p>

            <Card>
              {/* Application selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Application
                </label>
                <select
                  value={selectedSettingsAppId}
                  onChange={(e) => setSelectedSettingsAppId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an application...</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.platform})
                    </option>
                  ))}
                </select>
              </div>

              {configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                  <span className="ml-3 text-sm text-gray-500">Loading settings...</span>
                </div>
              ) : !selectedSettingsAppId ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Select an application to configure agent settings
                </div>
              ) : !appConfig?.repo ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  This application has no linked GitHub repository
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Agent Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Agent Mode
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="radio"
                          name="agentMode"
                          value="auto"
                          checked={agentMode === 'auto'}
                          onChange={(e) => setAgentMode(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Fully Autonomous
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Agent generates and pushes code automatically
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="radio"
                          name="agentMode"
                          value="review_plan"
                          checked={agentMode === 'review_plan'}
                          onChange={(e) => setAgentMode(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Review Plan Before Code Generation
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Human approves the action plan before code generation
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="radio"
                          name="agentMode"
                          value="review_all"
                          checked={agentMode === 'review_all'}
                          onChange={(e) => setAgentMode(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Review Plan and Code Before Push
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Human reviews both plan and generated code
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Max Retries */}
                  <Input
                    type="number"
                    label="Max Retries"
                    value={maxRetries}
                    onChange={(e) => {
                      setMaxRetries(Number(e.target.value));
                      if (agentFieldErrors.maxRetries) {
                        setAgentFieldErrors((prev) => ({ ...prev, maxRetries: '' }));
                      }
                    }}
                    onBlur={(e) => {
                      const err = validateNumberField(Number(e.target.value), 1, 10, 'Max Retries');
                      setAgentFieldErrors((prev) => ({ ...prev, maxRetries: err }));
                    }}
                    error={agentFieldErrors.maxRetries}
                    min={1}
                    max={10}
                    helperText={agentFieldErrors.maxRetries ? undefined : 'Number of retry attempts if agent task fails (1-10)'}
                  />

                  {/* Timeout */}
                  <Input
                    type="number"
                    label="Timeout (minutes)"
                    value={timeoutMinutes}
                    onChange={(e) => {
                      setTimeoutMinutes(Number(e.target.value));
                      if (agentFieldErrors.timeoutMinutes) {
                        setAgentFieldErrors((prev) => ({ ...prev, timeoutMinutes: '' }));
                      }
                    }}
                    onBlur={(e) => {
                      const err = validateNumberField(Number(e.target.value), 1, 30, 'Timeout');
                      setAgentFieldErrors((prev) => ({ ...prev, timeoutMinutes: err }));
                    }}
                    error={agentFieldErrors.timeoutMinutes}
                    min={1}
                    max={30}
                    helperText={agentFieldErrors.timeoutMinutes ? undefined : 'Maximum time for agent task execution (1-30 minutes)'}
                  />

                  {/* Save button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSaveAgentSettings}
                      isLoading={savingAgent}
                      disabled={savingAgent || !isAgentFormValid}
                    >
                      Save Agent Settings
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Section 5: Merge Settings */}
        {hasInstallations && applications.length > 0 && selectedSettingsAppId && appConfig?.repo && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Merge Settings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure pull request merge behavior for automated workflows.
            </p>

            <Card>
              <div className="space-y-4">
                {/* Auto-merge toggle */}
                <div className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Auto-merge
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Automatically merge pull requests when all checks pass
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoMergeEnabled(!autoMergeEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoMergeEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoMergeEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Merge Strategy */}
                <Select
                  label="Merge Strategy"
                  options={[
                    { value: 'squash', label: 'Squash and merge' },
                    { value: 'merge', label: 'Create a merge commit' },
                    { value: 'rebase', label: 'Rebase and merge' },
                  ]}
                  value={mergeStrategy}
                  onChange={(e) => setMergeStrategy(e.target.value as any)}
                />

                {/* Required Reviews */}
                <Input
                  type="number"
                  label="Required Reviews"
                  value={requiredReviews}
                  onChange={(e) => {
                    setRequiredReviews(Number(e.target.value));
                    if (mergeFieldErrors.requiredReviews) {
                      setMergeFieldErrors((prev) => ({ ...prev, requiredReviews: '' }));
                    }
                  }}
                  onBlur={(e) => {
                    const err = validateNumberField(Number(e.target.value), 0, 5, 'Required Reviews');
                    setMergeFieldErrors((prev) => ({ ...prev, requiredReviews: err }));
                  }}
                  error={mergeFieldErrors.requiredReviews}
                  min={0}
                  max={5}
                  helperText={mergeFieldErrors.requiredReviews ? undefined : 'Number of required approving reviews (0-5)'}
                />

                {/* Save button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveMergeSettings}
                    isLoading={savingMerge}
                    disabled={savingMerge || !isMergeFormValid}
                  >
                    Save Merge Settings
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Section 6: Template Link */}
        {hasInstallations && applications.length > 0 && selectedSettingsAppId && appConfig?.repo && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Issue Template
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Customize the GitHub issue template for automated issue creation.
            </p>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Configure Issue Template
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Customize how tickets are formatted when creating GitHub issues
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.location.href = '/dashboard/settings/github/template';
                  }}
                >
                  Configure Template
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
