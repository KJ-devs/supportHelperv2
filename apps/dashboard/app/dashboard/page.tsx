'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import { analyticsApi } from '@/lib/api/analytics';
import type { Ticket, TicketStats } from '@/lib/types/ticket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Badge, SeverityBadge } from '@/components/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Ticket as TicketIcon,
  AppWindow,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTodayDate(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle: string;
  borderColor: string;
}

function KpiCard({ icon, label, value, subtitle, borderColor }: KpiCardProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-gray-800/20 p-5 border-l-4 ${borderColor}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className="ml-4 text-gray-400 dark:text-gray-500">{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('dashboard');
  const tTickets = useTranslations('tickets');

  const [stats, setStats] = useState<TicketStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [avgResolutionTimeHours, setAvgResolutionTimeHours] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ticketStats, ticketsResponse, trendsResult] = await Promise.allSettled([
        ticketsApi.getStats('month'),
        ticketsApi.getTickets({
          page: 1,
          limit: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
        analyticsApi.getResolutionTrends(),
      ]);

      if (ticketStats.status === 'fulfilled') setStats(ticketStats.value);
      if (ticketsResponse.status === 'fulfilled') setRecentTickets(ticketsResponse.value.data);
      if (trendsResult.status === 'fulfilled' && trendsResult.value.data.length > 0) {
        const lastMonth = trendsResult.value.data.at(-1);
        if (lastMonth) setAvgResolutionTimeHours(lastMonth.avgResolutionTimeHours);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading, fetchData]);

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return null;
  }

  const locale =
    typeof document !== 'undefined'
      ? (document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] ?? 'fr')
      : 'fr';

  const openTickets = stats
    ? (stats.byStatus.new || 0) + (stats.byStatus.open || 0) + (stats.byStatus.in_progress || 0)
    : 0;

  const criticalTickets = stats ? stats.bySeverity.critical || 0 : 0;

  const resolvedTickets = stats ? (stats.byStatus.resolved || 0) + (stats.byStatus.closed || 0) : 0;

  const resolutionRate =
    stats && stats.total > 0 ? `${((resolvedTickets / stats.total) * 100).toFixed(0)}%` : 'N/A';

  const quickLinks = [
    {
      titleKey: 'nav.tickets',
      icon: TicketIcon,
      descriptionKey: 'ticketsDescription',
      href: '/dashboard/tickets',
      stats: stats ? t('ticketsOpen', { count: openTickets }) : '—',
    },
    {
      titleKey: 'nav.applications',
      icon: AppWindow,
      descriptionKey: 'applicationsDescription',
      href: '/dashboard/applications',
      stats: t('manageSDKKeys'),
    },
    {
      titleKey: 'nav.analytics',
      icon: BarChart3,
      descriptionKey: 'analyticsDescription',
      href: '/dashboard/analytics',
      stats: t('viewReports'),
    },
  ];

  const tNav = (key: string) => {
    const navMap: Record<string, string> = {
      'nav.tickets': 'Tickets',
      'nav.applications': 'Applications',
      'nav.analytics': 'Analytics',
    };
    return navMap[key] || key;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('welcome', { name: user.name || user.email })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{t('subtitle')}</p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize hidden sm:block">
            {formatTodayDate(locale)}
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            icon={<TicketIcon className="w-6 h-6" aria-hidden="true" />}
            label={t('openTickets')}
            value={openTickets}
            subtitle={stats ? t('total', { count: stats.total }) : t('notAvailable')}
            borderColor="border-blue-500"
          />
          <KpiCard
            icon={<AlertTriangle className="w-6 h-6" aria-hidden="true" />}
            label={t('criticalTickets')}
            value={criticalTickets}
            subtitle={t('actionRequired')}
            borderColor="border-red-500"
          />
          <KpiCard
            icon={<CheckCircle className="w-6 h-6" aria-hidden="true" />}
            label={t('resolutionRate')}
            value={resolutionRate}
            subtitle={t('resolved', { count: resolvedTickets })}
            borderColor="border-green-500"
          />
          <KpiCard
            icon={<Clock className="w-6 h-6" aria-hidden="true" />}
            label={t('avgResolutionTime')}
            value={
              avgResolutionTimeHours !== null
                ? `${Math.round(avgResolutionTimeHours)}h`
                : t('notAvailable')
            }
            subtitle={avgResolutionTimeHours !== null ? t('lastMonth') : t('notAvailable')}
            borderColor="border-gray-400"
          />
        </div>

        {/* Recent Tickets */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('recentTickets')}
            </h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-gray-800/20 overflow-hidden">
            {recentTickets.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <TicketIcon className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p className="text-sm">{t('noTickets')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('tableTitle')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('tableStatus')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('tableSeverity')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('tableCreatedAt')}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t('tableAction')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {recentTickets.map(ticket => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 block max-w-xs">
                            {ticket.title}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant={
                              ticket.status === 'new'
                                ? 'info'
                                : ticket.status === 'open'
                                  ? 'warning'
                                  : ticket.status === 'in_progress'
                                    ? 'info'
                                    : ticket.status === 'resolved'
                                      ? 'success'
                                      : 'default'
                            }
                          >
                            {ticket.status === 'new'
                              ? t('statuses.new')
                              : ticket.status === 'open'
                                ? t('statuses.open')
                                : ticket.status === 'in_progress'
                                  ? t('statuses.inProgress')
                                  : ticket.status === 'resolved'
                                    ? t('statuses.resolved')
                                    : ticket.status === 'closed'
                                      ? t('statuses.closed')
                                      : ticket.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SeverityBadge severity={ticket.severity} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(ticket.createdAt, locale)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1 justify-end"
                          >
                            {tTickets('view')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href="/dashboard/tickets"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
            >
              {t('viewAllTickets')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('quickAccess')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map(link => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <Card className="h-full hover:shadow-lg dark:hover:shadow-gray-700/20 transition-shadow cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon
                        className="w-5 h-5 text-blue-600 dark:text-blue-400"
                        aria-hidden="true"
                      />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {tNav(link.titleKey)}
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {t(link.descriptionKey as any)}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{link.stats}</span>
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center gap-1">
                        {tTickets('view')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
