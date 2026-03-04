'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import type { Ticket, TicketStats } from '@/lib/types/ticket';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Badge, SeverityBadge } from '@/components/ui';
import Link from 'next/link';
import {
  Ticket as TicketIcon,
  AppWindow,
  BarChart3,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('fr-FR', {
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

  const [stats, setStats] = useState<TicketStats | null>(null);
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ticketStats, ticketsResponse] = await Promise.all([
        ticketsApi.getStats('month'),
        ticketsApi.getTickets({
          page: 1,
          limit: 5,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }),
      ]);
      setStats(ticketStats);
      setRecentTickets(ticketsResponse.data);
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

  const openTickets = stats
    ? (stats.byStatus.new || 0) + (stats.byStatus.open || 0) + (stats.byStatus.in_progress || 0)
    : 0;

  const criticalTickets = stats ? stats.bySeverity.critical || 0 : 0;

  const resolvedTickets = stats ? (stats.byStatus.resolved || 0) + (stats.byStatus.closed || 0) : 0;

  const resolutionRate =
    stats && stats.total > 0 ? `${((resolvedTickets / stats.total) * 100).toFixed(0)}%` : 'N/A';

  const quickLinks = [
    {
      title: 'Tickets',
      icon: TicketIcon,
      description: 'Voir et gérer les tickets de support',
      href: '/dashboard/tickets',
      stats: stats ? `${openTickets} ouverts` : '—',
    },
    {
      title: 'Applications',
      icon: AppWindow,
      description: 'Gérer vos applications connectées',
      href: '/dashboard/applications',
      stats: 'Gérer les clés SDK',
    },
    {
      title: 'Analytiques',
      icon: BarChart3,
      description: 'Métriques et statistiques détaillées',
      href: '/dashboard/analytics',
      stats: 'Voir les rapports',
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Bienvenue, {user.name || user.email}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Voici un aperçu de votre plateforme de support
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize hidden sm:block">
            {formatTodayDate()}
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            icon={<TicketIcon className="w-6 h-6" aria-hidden="true" />}
            label="Tickets ouverts"
            value={openTickets * 1000000}
            subtitle={stats ? `${stats.total} au total` : 'Chargement...'}
            borderColor="border-blue-500"
          />
          <KpiCard
            icon={<AlertTriangle className="w-6 h-6" aria-hidden="true" />}
            label="Tickets critiques"
            value={criticalTickets}
            subtitle="Action requise"
            borderColor="border-red-500"
          />
          <KpiCard
            icon={<CheckCircle className="w-6 h-6" aria-hidden="true" />}
            label="Taux de resolution"
            value={resolutionRate}
            subtitle={`${resolvedTickets} resolus`}
            borderColor="border-green-500"
          />
          <KpiCard
            icon={<Clock className="w-6 h-6" aria-hidden="true" />}
            label="Temps moy. resolution"
            value="N/A"
            subtitle="Non disponible"
            borderColor="border-gray-400"
          />
        </div>

        {/* Recent Tickets */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Tickets recents
            </h2>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-gray-800/20 overflow-hidden">
            {recentTickets.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <TicketIcon className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p className="text-sm">Aucun ticket pour le moment</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Titre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Severite
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Cree le
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
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
                              ? 'Nouveau'
                              : ticket.status === 'open'
                                ? 'Ouvert'
                                : ticket.status === 'in_progress'
                                  ? 'En cours'
                                  : ticket.status === 'resolved'
                                    ? 'Resolu'
                                    : ticket.status === 'closed'
                                      ? 'Ferme'
                                      : ticket.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <SeverityBadge severity={ticket.severity} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1 justify-end"
                          >
                            Voir <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
              Voir tous les tickets <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Acces rapide
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
                        {link.title}
                      </h3>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {link.description}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{link.stats}</span>
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center gap-1">
                        Voir <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
