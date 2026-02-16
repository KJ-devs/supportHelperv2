'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Badge, Button } from '@/components/ui';
import { apiRequest } from '@/lib/api/client';

interface LicenseLimits {
  maxTicketsPerMonth: number | null;
  maxAgentTasksPerMonth: number | null;
  maxRepos: number | null;
  maxUsers: number | null;
}

interface LicenseUsage {
  tickets: { current: number; limit: number | null };
  agentTasks: { current: number; limit: number | null };
  users: { current: number; limit: number | null };
  repos: { current: number; limit: number | null };
}

interface LicenseInfo {
  plan: 'free' | 'pro' | 'enterprise';
  limits: LicenseLimits;
  usage: LicenseUsage;
  expiresAt: string | null;
  valid: boolean;
  features: string[];
}

export default function LicenseSettingsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      fetchLicenseInfo();
    }
  }, [authLoading]);

  const fetchLicenseInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiRequest<LicenseInfo>('/api/system/license');
      setLicenseInfo(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load license information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLicense = async () => {
    if (!licenseKey.trim()) {
      return;
    }
    try {
      setIsUpdating(true);
      await apiRequest('/api/system/license', {
        method: 'POST',
        body: JSON.stringify({ licenseKey }),
      });
      setLicenseKey('');
      await fetchLicenseInfo();
    } catch (err: any) {
      setError(err.message || 'Failed to update license');
    } finally {
      setIsUpdating(false);
    }
  };

  const getPlanBadgeVariant = (plan: string): 'default' | 'success' | 'warning' => {
    if (plan === 'enterprise') return 'success';
    if (plan === 'pro') return 'warning';
    return 'default';
  };

  const getStatusBadgeVariant = (valid: boolean, expiresAt: string | null): 'success' | 'danger' | 'warning' => {
    if (!valid) return 'danger';
    if (expiresAt) {
      const daysUntilExpiry = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 7) return 'warning';
    }
    return 'success';
  };

  const getUsageColor = (current: number, limit: number | null): string => {
    if (limit === null) return 'bg-green-500';
    const percentage = (current / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUsagePercentage = (current: number, limit: number | null): number => {
    if (limit === null) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const formatLimit = (limit: number | null): string => {
    return limit === null ? 'Unlimited' : limit.toString();
  };

  const hasFeature = (feature: string): boolean => {
    return licenseInfo?.features.includes(feature) ?? false;
  };

  const planFeatures = {
    free: {
      tickets: 50,
      aiTasks: 10,
      repos: 1,
      users: 3,
      sso: false,
      auditLogs: false,
      autoMerge: false,
      multiProviderAI: false,
    },
    pro: {
      tickets: 500,
      aiTasks: 100,
      repos: 5,
      users: 20,
      sso: false,
      auditLogs: true,
      autoMerge: true,
      multiProviderAI: true,
    },
    enterprise: {
      tickets: 'Unlimited',
      aiTasks: 'Unlimited',
      repos: 'Unlimited',
      users: 'Unlimited',
      sso: true,
      auditLogs: true,
      autoMerge: true,
      multiProviderAI: true,
    },
  };

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (error && !licenseInfo) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto">
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
                License
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              License Settings
            </h1>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">
              Error Loading License
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button onClick={fetchLicenseInfo} className="mt-4">
              Retry
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
              Settings
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">
              License
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            License Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your subscription plan, view usage limits, and update your license key.
          </p>
        </div>

        {/* Current Plan Card */}
        {licenseInfo && (
          <>
            <Card className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white capitalize">
                      {licenseInfo.plan} Plan
                    </h2>
                    <Badge variant={getPlanBadgeVariant(licenseInfo.plan)}>
                      {licenseInfo.plan.toUpperCase()}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(licenseInfo.valid, licenseInfo.expiresAt)}>
                      {!licenseInfo.valid
                        ? 'Invalid'
                        : licenseInfo.expiresAt
                        ? `Expires ${new Date(licenseInfo.expiresAt).toLocaleDateString()}`
                        : 'Active'}
                    </Badge>
                  </div>
                  {licenseInfo.expiresAt && licenseInfo.valid && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your license will expire on{' '}
                      {new Date(licenseInfo.expiresAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                  {!licenseInfo.valid && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Your license is invalid or expired. Please update your license key.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Usage Section */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Usage & Limits
              </h2>
              <Card>
                <div className="space-y-6">
                  {/* Tickets */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tickets This Month
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {licenseInfo.usage.tickets.current} / {formatLimit(licenseInfo.usage.tickets.limit)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${getUsageColor(
                          licenseInfo.usage.tickets.current,
                          licenseInfo.usage.tickets.limit
                        )}`}
                        style={{
                          width: `${getUsagePercentage(
                            licenseInfo.usage.tickets.current,
                            licenseInfo.usage.tickets.limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Agent AI Tasks */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Agent AI Tasks
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {licenseInfo.usage.agentTasks.current} / {formatLimit(licenseInfo.usage.agentTasks.limit)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${getUsageColor(
                          licenseInfo.usage.agentTasks.current,
                          licenseInfo.usage.agentTasks.limit
                        )}`}
                        style={{
                          width: `${getUsagePercentage(
                            licenseInfo.usage.agentTasks.current,
                            licenseInfo.usage.agentTasks.limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Connected Repos */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Connected Repositories
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {licenseInfo.usage.repos.current} / {formatLimit(licenseInfo.usage.repos.limit)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${getUsageColor(
                          licenseInfo.usage.repos.current,
                          licenseInfo.usage.repos.limit
                        )}`}
                        style={{
                          width: `${getUsagePercentage(
                            licenseInfo.usage.repos.current,
                            licenseInfo.usage.repos.limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Users */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Active Users
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {licenseInfo.usage.users.current} / {formatLimit(licenseInfo.usage.users.limit)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${getUsageColor(
                          licenseInfo.usage.users.current,
                          licenseInfo.usage.users.limit
                        )}`}
                        style={{
                          width: `${getUsagePercentage(
                            licenseInfo.usage.users.current,
                            licenseInfo.usage.users.limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Features Section */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Enabled Features
              </h2>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Auto-merge */}
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {hasFeature('auto-merge') ? (
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Auto-merge PRs
                    </span>
                  </div>

                  {/* Audit Logs */}
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {hasFeature('audit-logs') ? (
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Audit Logs
                    </span>
                  </div>

                  {/* Multi-provider AI */}
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {hasFeature('multi-provider-ai') ? (
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Multi-Provider AI
                    </span>
                  </div>

                  {/* SSO */}
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    {hasFeature('sso') ? (
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      SSO (SAML/OIDC)
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Plan Comparison Table */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Plan Comparison
              </h2>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                          Feature
                        </th>
                        <th
                          className={`text-center py-3 px-4 font-medium ${
                            licenseInfo.plan === 'free'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Free
                        </th>
                        <th
                          className={`text-center py-3 px-4 font-medium ${
                            licenseInfo.plan === 'pro'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Pro
                        </th>
                        <th
                          className={`text-center py-3 px-4 font-medium ${
                            licenseInfo.plan === 'enterprise'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Enterprise
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          Tickets / month
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.free.tickets}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.pro.tickets}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.enterprise.tickets}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          AI tasks / month
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.free.aiTasks}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.pro.aiTasks}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.enterprise.aiTasks}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          Repositories
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.free.repos}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.pro.repos}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.enterprise.repos}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">Users</td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.free.users}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.pro.users}
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          {planFeatures.enterprise.users}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          SSO (SAML/OIDC)
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          -
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          -
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-green-500 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          Audit Logs
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          -
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-green-500 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-green-500 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          Auto-merge
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'free' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          -
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'pro' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-green-500 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </td>
                        <td
                          className={`text-center py-3 px-4 ${
                            licenseInfo.plan === 'enterprise' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <svg
                            className="w-5 h-5 text-green-500 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* License Key Update */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Update License Key
              </h2>
              <Card>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      License Key
                    </label>
                    <textarea
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="Paste your license key here..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter your license key to upgrade or update your plan.
                    </p>
                  </div>
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleUpdateLicense}
                      disabled={!licenseKey.trim() || isUpdating}
                      isLoading={isUpdating}
                    >
                      Update License
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
