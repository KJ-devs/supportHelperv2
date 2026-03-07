/**
 * Plan & Usage Settings Page
 * Displays plan information, usage metrics, and billing details
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Badge, Button } from '@/components/ui';
import { getCurrentUsage, getUsageHistory } from '@/lib/api/usage';
import { UsageBar } from '@/components/usage/UsageBar';
import { UsageHistoryChart } from '@/components/usage/UsageHistoryChart';
import type { UsageResponse, UsageHistoryResponse } from '@/lib/types/usage';

export default function PlanUsagePage() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('settingsPlan');

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [history, setHistory] = useState<UsageHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      fetchUsageData();
    }
  }, [authLoading]);

  const fetchUsageData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [usageData, historyData] = await Promise.all([getCurrentUsage(), getUsageHistory()]);
      setUsage(usageData);
      setHistory(historyData);
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanBadgeVariant = (plan: string): 'default' | 'success' | 'warning' => {
    if (plan === 'enterprise') return 'success';
    if (plan === 'pro') return 'warning';
    return 'default';
  };

  const getMetricLabel = (metric: string): string => {
    const labels: Record<string, string> = {
      tickets: t('metricTickets'),
      agent_tasks: t('metricAgentTasks'),
      users: t('metricUsers'),
      repos: t('metricRepos'),
    };
    return labels[metric] || metric;
  };

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (error && !usage) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto">
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
                {t('title')}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">
              {t('errorTitle')}
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button onClick={fetchUsageData} className="mt-4">
              {t('retry')}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

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
            <span className="text-sm text-gray-900 dark:text-white font-medium">{t('title')}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>

        {usage && (
          <>
            {/* Plan Overview Card */}
            <Card className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white capitalize">
                      {t('planLabel', { plan: usage.plan })}
                    </h2>
                    <Badge variant={getPlanBadgeVariant(usage.plan)}>
                      {usage.plan.toUpperCase()}
                    </Badge>
                  </div>
                  {usage.expiresAt && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('licenseExpires', {
                        date: new Date(usage.expiresAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }),
                      })}
                    </p>
                  )}
                </div>
                <div>
                  <a href="/dashboard/settings/license">
                    <Button>{t('manageLicense')}</Button>
                  </a>
                </div>
              </div>
            </Card>

            {/* Alerts Section */}
            {usage.alerts && usage.alerts.length > 0 && (
              <div className="mb-6 space-y-3">
                {usage.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
                  >
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-orange-500 mr-3 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div>
                        <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                          {t('usageWarning')}
                        </h3>
                        <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usage Metrics Section */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('currentUsage')}
              </h2>
              <Card>
                <div className="space-y-6">
                  {usage.metrics.map((metric, idx) => (
                    <UsageBar
                      key={idx}
                      label={getMetricLabel(metric.metric)}
                      current={metric.current}
                      limit={metric.limit}
                      percentage={metric.percentage}
                    />
                  ))}
                </div>
              </Card>
            </div>

            {/* Usage History Chart */}
            {history && history.data.length > 0 && (
              <div className="mb-6">
                <Card>
                  <UsageHistoryChart data={history.data} />
                </Card>
              </div>
            )}

            {/* Plan Features Info */}
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('planFeatures')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t.rich('planFeaturesDetail', {
                  licenseLink: chunks => (
                    <a
                      href="/dashboard/settings/license"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('upgradeNote')}</p>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
