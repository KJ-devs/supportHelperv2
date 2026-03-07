'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card } from '@/components/ui';
import { healthApi, type HealthStatus, type HealthCheck } from '@/lib/api/health';

const REFRESH_INTERVAL = 30_000; // 30 seconds

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function StatusDot({ status }: { status: 'healthy' | 'unhealthy' | 'degraded' }) {
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
  };
  return <span className={`inline-block w-3 h-3 rounded-full ${colors[status]}`} />;
}

function OverallBanner({
  status,
  t,
}: {
  status: 'healthy' | 'degraded' | 'unhealthy';
  t: ReturnType<typeof useTranslations<'settingsStatus'>>;
}) {
  const config = {
    healthy: {
      bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-300',
      label: t('bannerHealthy'),
    },
    degraded: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-300',
      label: t('bannerDegraded'),
    },
    unhealthy: {
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-300',
      label: t('bannerUnhealthy'),
    },
  };
  const c = config[status];
  return (
    <div className={`rounded-lg border p-4 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <span className={`text-lg font-semibold ${c.text}`}>{c.label}</span>
      </div>
    </div>
  );
}

function ServiceRow({
  name,
  check,
  t,
}: {
  name: string;
  check: HealthCheck;
  t: ReturnType<typeof useTranslations<'settingsStatus'>>;
}) {
  const displayNames: Record<string, string> = {
    postgres: 'PostgreSQL',
    redis: 'Redis',
    minio: 'MinIO / S3',
    memory: 'Memory',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="flex items-center gap-3">
        <StatusDot status={check.status} />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {displayNames[name] || name}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {check.responseTime !== undefined && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {check.responseTime}ms
          </span>
        )}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            check.status === 'healthy'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {check.status === 'healthy' ? t('statusOperational') : t('statusDown')}
        </span>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('settingsStatus');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setError(null);
      const data = await healthApi.getHealth();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!authLoading) {
      fetchHealth();
      const interval = setInterval(fetchHealth, REFRESH_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [authLoading, fetchHealth]);

  if (authLoading || loading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb + Header */}
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
              {t('breadcrumbStatus')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{t('description')}</p>
            </div>
            <div className="text-right text-xs text-gray-400 dark:text-gray-500">
              {lastRefresh && <p>{t('lastChecked', { time: lastRefresh.toLocaleTimeString() })}</p>}
              <p>{t('autoRefresh')}</p>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={fetchHealth}
              className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {health && (
          <>
            {/* Overall Status Banner */}
            <div className="mb-6">
              <OverallBanner status={health.status} t={t} />
            </div>

            {/* Services Grid */}
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('services')}
              </h2>
              <div>
                {health.services &&
                  Object.entries(health.services).map(([name, check]) => (
                    <ServiceRow key={name} name={name} check={check} t={t} />
                  ))}
              </div>
            </Card>

            {/* System Info */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('uptime')}
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                    {formatUptime(health.uptime)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('version')}
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                    {health.version}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('status')}
                  </p>
                  <p
                    className={`text-lg font-semibold capitalize ${
                      health.status === 'healthy'
                        ? 'text-green-600 dark:text-green-400'
                        : health.status === 'degraded'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {health.status === 'healthy'
                      ? t('statusHealthy')
                      : health.status === 'degraded'
                        ? t('statusDegraded')
                        : t('statusUnhealthy')}
                  </p>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
