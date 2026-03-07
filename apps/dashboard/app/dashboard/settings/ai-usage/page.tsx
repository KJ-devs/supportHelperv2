'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card } from '@/components/ui';
import { aiUsageApi, type AiUsageResponse, type AiUsageDayStats } from '@/lib/api/ai-usage';

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(2)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ReactNode;
}

function KpiCard({ label, value, subLabel, icon }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-start gap-4">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {subLabel && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple CSS bar chart (no external library)
// ---------------------------------------------------------------------------

function CostChart({ data }: { data: AiUsageDayStats[] }) {
  const maxCost = Math.max(...data.map(d => d.cost), 0.000001);

  return (
    <div className="w-full">
      <div className="flex items-end gap-0.5 h-40">
        {data.map(day => {
          const heightPct = (day.cost / maxCost) * 100;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  <div className="font-semibold">{formatDate(day.date)}</div>
                  <div>{formatCurrency(day.cost)}</div>
                  <div>{formatTokens(day.tokens)} tokens</div>
                  <div>{day.requests} req</div>
                </div>
              </div>

              <div
                className="w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-150 hover:bg-blue-600 dark:hover:bg-blue-300 min-h-[2px]"
                style={{ height: `${Math.max(heightPct, 1)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis: show first, middle, and last date labels */}
      <div className="flex justify-between mt-2">
        {data.length > 0 && (
          <>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatDate(data[0]!.date)}
            </span>
            {data.length > 2 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatDate(data[Math.floor(data.length / 2)]!.date)}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatDate(data[data.length - 1]!.date)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function AiUsagePage() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('settingsAiUsage');
  const [data, setData] = useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const load = async () => {
      try {
        const result = await aiUsageApi.getUsage();
        setData(result);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, t]);

  if (authLoading || loading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-2 text-sm">
            <a
              href="/dashboard/settings"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {t('breadcrumbSettings')}
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-900 dark:text-white font-medium">{t('title')}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>

        {error && (
          <Card>
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label={t('totalCost30d')}
                value={formatCurrency(data.totalCost)}
                subLabel={t('usd')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
              <KpiCard
                label={t('totalTokens')}
                value={formatTokens(data.totalTokens)}
                subLabel={t('inputOutput')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                    />
                  </svg>
                }
              />
              <KpiCard
                label={t('totalRequests')}
                value={data.totalRequests.toLocaleString()}
                subLabel={t('aiCalls')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
              />
              <KpiCard
                label={t('costPerTicket')}
                value={formatCurrency(data.costPerTicket)}
                subLabel={t('analyzedTickets')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                }
              />
            </div>

            {/* Daily Cost Chart */}
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {t('dailyCost')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('dailyCostDetail')}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  USD
                </span>
              </div>

              {data.byDay.every(d => d.cost === 0) ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-500">
                  <svg
                    className="w-8 h-8 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <p className="text-sm">{t('noUsageData')}</p>
                </div>
              ) : (
                <CostChart data={data.byDay} />
              )}
            </Card>

            {/* Daily Breakdown Table */}
            <Card>
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('dailyBreakdown')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('dailyBreakdownDetail')}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400 w-32">
                        {t('colDate')}
                      </th>
                      <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">
                        {t('colCost')}
                      </th>
                      <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">
                        {t('colTokens')}
                      </th>
                      <th className="text-right py-2 pl-4 font-medium text-gray-500 dark:text-gray-400">
                        {t('colRequests')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.byDay]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(day => (
                        <tr
                          key={day.date}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="py-2.5 pr-4 text-gray-900 dark:text-white font-medium">
                            {formatDate(day.date)}
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">
                              {day.date}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-gray-900 dark:text-white">
                            {day.cost > 0 ? (
                              formatCurrency(day.cost)
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {day.tokens > 0 ? (
                              formatTokens(day.tokens)
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pl-4 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {day.requests > 0 ? (
                              day.requests.toLocaleString()
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                      <td className="py-2.5 pr-4 font-semibold text-gray-900 dark:text-white text-sm">
                        {t('total')}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(data.totalCost)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                        {formatTokens(data.totalTokens)}
                      </td>
                      <td className="py-2.5 pl-4 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                        {data.totalRequests.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
