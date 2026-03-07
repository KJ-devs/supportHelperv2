'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Badge, Input, Select, useToast } from '@/components/ui';
import { GitHubAppInstallations } from '@/components/github/GitHubAppInstallations';
import { RepoSelector } from '@/components/github/RepoSelector';
import { githubApi, type GitHubAppInfo, type GitHubInstallation } from '@/lib/api/github';
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
  const t = useTranslations('settingsGithub');
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
      showToast('success', t('installSuccess'));
      window.history.replaceState({}, '', '/dashboard/settings/github');
    } else if (errorParam) {
      showToast('error', t('installFailed', { error: errorParam }));
      window.history.replaceState({}, '', '/dashboard/settings/github');
    }
  }, [searchParams, showToast, t]);

  // Fetch app info
  const fetchAppInfo = useCallback(async () => {
    try {
      setAppInfoLoading(true);
      setAppInfoError(null);
      const info = await githubApi.getAppInfo();
      setAppInfo(info);
    } catch (err: any) {
      setAppInfoError(err.message || t('appInfoLoadError'));
    } finally {
      setAppInfoLoading(false);
    }
  }, [t]);

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
      if (data && data.length > 0) {
        const linkedApps = await Promise.all(
          data.map(async app => {
            try {
              const config = await githubApi.getGithubConfig(app.id);
              return config?.repo ? app.id : null;
            } catch {
              return null;
            }
          })
        );
        const firstLinked = linkedApps.find(id => id !== null);
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

  const handleInstall = async () => {
    try {
      const data = await githubApi.getInstallUrl();
      window.location.href = data.url;
    } catch (err: any) {
      showToast('error', err.message || t('installUrlError'));
    }
  };

  const handleRemoveInstallation = async (id: string) => {
    try {
      setRemovingId(id);
      await githubApi.removeInstallation(id);
      setInstallations(prev => prev.filter(i => i.id !== id));
      showToast('success', t('removeSuccess'));
    } catch (err: any) {
      showToast('error', err.message || t('removeError'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleSyncInstallations = async () => {
    try {
      setInstallationsLoading(true);
      const result = await githubApi.syncInstallations();
      if (result.synced > 0) {
        setInstallations(result.installations);
        showToast('success', t('syncSuccess', { count: result.synced }));
      } else {
        showToast('success', t('syncUpToDate'));
      }
    } catch (err: any) {
      showToast('error', err.message || t('syncError'));
    } finally {
      setInstallationsLoading(false);
      fetchInstallations();
    }
  };

  const fetchAppConfig = useCallback(async () => {
    if (!selectedSettingsAppId) {
      setAppConfig(null);
      return;
    }
    try {
      setConfigLoading(true);
      const config = await githubApi.getGithubConfig(selectedSettingsAppId);
      setAppConfig(config);

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

  useEffect(() => {
    fetchAppConfig();
  }, [fetchAppConfig]);

  const validateNumberField = (value: number, min: number, max: number, label: string): string => {
    if (!Number.isInteger(value) || value < min || value > max) {
      return t('fieldRangeError', { label, min, max });
    }
    return '';
  };

  const getAgentFieldErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const retriesErr = validateNumberField(maxRetries, 1, 10, t('maxRetries'));
    if (retriesErr) errors.maxRetries = retriesErr;
    const timeoutErr = validateNumberField(timeoutMinutes, 1, 30, t('timeoutMinutes'));
    if (timeoutErr) errors.timeoutMinutes = timeoutErr;
    return errors;
  };

  const getMergeFieldErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const reviewsErr = validateNumberField(requiredReviews, 0, 5, t('requiredReviews'));
    if (reviewsErr) errors.requiredReviews = reviewsErr;
    return errors;
  };

  const isAgentFormValid = Object.keys(getAgentFieldErrors()).length === 0;
  const isMergeFormValid = Object.keys(getMergeFieldErrors()).length === 0;

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
      showToast('success', t('agentSaveSuccess'));
      setAgentFieldErrors({});
      fetchAppConfig();
    } catch (err: any) {
      showToast('error', err.message || t('agentSaveError'));
    } finally {
      setSavingAgent(false);
    }
  };

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
      showToast('success', t('mergeSaveSuccess'));
      setMergeFieldErrors({});
      fetchAppConfig();
    } catch (err: any) {
      showToast('error', err.message || t('mergeSaveError'));
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
              {t('breadcrumbSettings')}
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">
              {t('breadcrumbGithub')}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>

        {/* Error State */}
        {appInfoError && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  {t('errorTitle')}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{appInfoError}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchAppInfo} className="ml-auto">
                {t('retry')}
              </Button>
            </div>
          </div>
        )}

        {/* Section 1: GitHub App Connection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t('sectionConnection')}
          </h2>

          {appInfoLoading ? (
            <Card>
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                <span className="ml-3 text-sm text-gray-500">{t('loadingAppInfo')}</span>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {appInfo?.appName || 'GitHub App'}
                      </h3>
                      {hasInstallations ? (
                        <Badge variant="success">{t('installed')}</Badge>
                      ) : (
                        <Badge variant="warning">{t('notInstalled')}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {hasInstallations
                        ? t('installationsActive', { count: installations.length })
                        : t('installPrompt')}
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
                    {t('syncFromGithub')}
                  </Button>
                  <Button onClick={handleInstall}>
                    {hasInstallations ? t('addInstallation') : t('installGithubApp')}
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
                {t('sectionInstallations')}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchInstallations}
                isLoading={installationsLoading}
              >
                {t('refresh')}
              </Button>
            </div>

            {installationsLoading && installations.length === 0 ? (
              <Card>
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                  <span className="ml-3 text-sm text-gray-500">{t('loadingInstallations')}</span>
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
              {t('sectionLinkRepo')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('linkRepoDescription')}
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
              {t('sectionAgentSettings')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('agentSettingsDescription')}
            </p>

            <Card>
              {/* Application selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('selectApplication')}
                </label>
                <select
                  value={selectedSettingsAppId}
                  onChange={e => setSelectedSettingsAppId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('selectApplicationPlaceholder')}</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>
                      {app.name} ({app.platform})
                    </option>
                  ))}
                </select>
              </div>

              {configLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                  <span className="ml-3 text-sm text-gray-500">{t('loadingSettings')}</span>
                </div>
              ) : !selectedSettingsAppId ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('selectAppToConfig')}
                </div>
              ) : !appConfig?.repo ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t('noLinkedRepo')}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Agent Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('agentMode')}
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="radio"
                          name="agentMode"
                          value="auto"
                          checked={agentMode === 'auto'}
                          onChange={e => setAgentMode(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {t('agentModeAuto')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('agentModeAutoDesc')}
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="radio"
                          name="agentMode"
                          value="review_plan"
                          checked={agentMode === 'review_plan'}
                          onChange={e => setAgentMode(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {t('agentModeReviewPlan')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('agentModeReviewPlanDesc')}
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="radio"
                          name="agentMode"
                          value="review_all"
                          checked={agentMode === 'review_all'}
                          onChange={e => setAgentMode(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {t('agentModeReviewAll')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('agentModeReviewAllDesc')}
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Max Retries */}
                  <Input
                    type="number"
                    label={t('maxRetries')}
                    value={maxRetries}
                    onChange={e => {
                      setMaxRetries(Number(e.target.value));
                      if (agentFieldErrors.maxRetries) {
                        setAgentFieldErrors(prev => ({ ...prev, maxRetries: '' }));
                      }
                    }}
                    onBlur={e => {
                      const err = validateNumberField(
                        Number(e.target.value),
                        1,
                        10,
                        t('maxRetries')
                      );
                      setAgentFieldErrors(prev => ({ ...prev, maxRetries: err }));
                    }}
                    error={agentFieldErrors.maxRetries}
                    min={1}
                    max={10}
                    helperText={agentFieldErrors.maxRetries ? undefined : t('maxRetriesHelper')}
                  />

                  {/* Timeout */}
                  <Input
                    type="number"
                    label={t('timeoutMinutes')}
                    value={timeoutMinutes}
                    onChange={e => {
                      setTimeoutMinutes(Number(e.target.value));
                      if (agentFieldErrors.timeoutMinutes) {
                        setAgentFieldErrors(prev => ({ ...prev, timeoutMinutes: '' }));
                      }
                    }}
                    onBlur={e => {
                      const err = validateNumberField(
                        Number(e.target.value),
                        1,
                        30,
                        t('timeoutMinutes')
                      );
                      setAgentFieldErrors(prev => ({ ...prev, timeoutMinutes: err }));
                    }}
                    error={agentFieldErrors.timeoutMinutes}
                    min={1}
                    max={30}
                    helperText={
                      agentFieldErrors.timeoutMinutes ? undefined : t('timeoutMinutesHelper')
                    }
                  />

                  {/* Save button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSaveAgentSettings}
                      isLoading={savingAgent}
                      disabled={savingAgent || !isAgentFormValid}
                    >
                      {t('saveAgentSettings')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Section 5: Merge Settings */}
        {hasInstallations &&
          applications.length > 0 &&
          selectedSettingsAppId &&
          appConfig?.repo && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('sectionMergeSettings')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('mergeSettingsDescription')}
              </p>

              <Card>
                <div className="space-y-4">
                  {/* Auto-merge toggle */}
                  <div className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('autoMerge')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('autoMergeHelper')}
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
                    label={t('mergeStrategy')}
                    options={[
                      { value: 'squash', label: t('mergeStrategySquash') },
                      { value: 'merge', label: t('mergeStrategyMerge') },
                      { value: 'rebase', label: t('mergeStrategyRebase') },
                    ]}
                    value={mergeStrategy}
                    onChange={e => setMergeStrategy(e.target.value as any)}
                  />

                  {/* Required Reviews */}
                  <Input
                    type="number"
                    label={t('requiredReviews')}
                    value={requiredReviews}
                    onChange={e => {
                      setRequiredReviews(Number(e.target.value));
                      if (mergeFieldErrors.requiredReviews) {
                        setMergeFieldErrors(prev => ({ ...prev, requiredReviews: '' }));
                      }
                    }}
                    onBlur={e => {
                      const err = validateNumberField(
                        Number(e.target.value),
                        0,
                        5,
                        t('requiredReviews')
                      );
                      setMergeFieldErrors(prev => ({ ...prev, requiredReviews: err }));
                    }}
                    error={mergeFieldErrors.requiredReviews}
                    min={0}
                    max={5}
                    helperText={
                      mergeFieldErrors.requiredReviews ? undefined : t('requiredReviewsHelper')
                    }
                  />

                  {/* Save button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSaveMergeSettings}
                      isLoading={savingMerge}
                      disabled={savingMerge || !isMergeFormValid}
                    >
                      {t('saveMergeSettings')}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

        {/* Section 6: Template Link */}
        {hasInstallations &&
          applications.length > 0 &&
          selectedSettingsAppId &&
          appConfig?.repo && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('sectionIssueTemplate')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('issueTemplateDescription')}
              </p>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('configureIssueTemplate')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('configureIssueTemplateDesc')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      window.location.href = '/dashboard/settings/github/template';
                    }}
                  >
                    {t('configureTemplate')}
                  </Button>
                </div>
              </Card>
            </div>
          )}
      </div>
    </DashboardLayout>
  );
}
