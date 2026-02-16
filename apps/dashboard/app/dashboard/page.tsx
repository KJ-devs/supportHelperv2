'use client';

import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card } from '@/components/ui';
import Link from 'next/link';
import { Ticket, AppWindow, BarChart3, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const { user, isLoading } = useRequireAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return null;
  }

  const quickLinks = [
    {
      title: 'Tickets',
      icon: Ticket,
      description: 'Voir et gérer les tickets de support',
      href: '/dashboard/tickets',
      stats: '0 nouveaux',
    },
    {
      title: 'Applications',
      icon: AppWindow,
      description: 'Gérer vos applications connectées',
      href: '/dashboard/applications',
      stats: '1 active',
    },
    {
      title: 'Analytiques',
      icon: BarChart3,
      description: 'Métriques et statistiques',
      href: '/dashboard/analytics',
      stats: 'Voir les rapports',
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Bienvenue, {user.name || user.email}! 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Voici un aperçu rapide de votre plateforme de support
          </p>
        </div>

        {/* User Info Card */}
        <Card className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Informations du compte</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</h3>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-mono truncate" title={user.id}>
                {user.id.substring(0, 20)}...
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tenant ID</h3>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-mono truncate" title={user.tenantId}>
                {user.tenantId.substring(0, 20)}...
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Rôle</h3>
              <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">{user.role}</p>
            </div>
          </div>
        </Card>

        {/* Quick Links */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Accès rapide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <Card className="h-full hover:shadow-lg dark:hover:shadow-gray-700/20 transition-shadow cursor-pointer">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {link.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{link.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{link.stats}</span>
                    <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                      Voir →
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
