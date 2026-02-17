/**
 * Dashboard Layout
 * Layout principal avec sidebar et header
 */

'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { SkipLink } from '@/components/ui/SkipLink';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/dashboard/agent-tasks', label: 'Agent Tasks', icon: '🤖' },
  { href: '/dashboard/applications', label: 'Applications', icon: '📱' },
  { href: '/dashboard/integrations', label: 'Integrations', icon: '🔌' },
  { href: '/dashboard/github', label: 'GitHub', icon: '🐙' },
  { href: '/dashboard/analytics', label: 'Analytiques', icon: '📈' },
  { href: '/dashboard/settings', label: 'Paramètres', icon: '⚙️' },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SkipLink />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 shadow-lg dark:shadow-gray-800/20 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64`}
        aria-label="Navigation principale"
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <Link href="/dashboard" className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2C10.9 2 10 2.9 10 4C10 4.6 10.2 5.1 10.6 5.5C10.2 5.9 10 6.4 10 7C10 8.1 10.9 9 12 9C13.1 9 14 8.1 14 7C14 6.4 13.8 5.9 13.4 5.5C13.8 5.1 14 4.6 14 4C14 2.9 13.1 2 12 2M12 11C10.9 11 10 11.9 10 13C10 14.1 10.9 15 12 15C13.1 15 14 14.1 14 13C14 11.9 13.1 11 12 11M20 13C20 9.1 17.4 5.8 13.8 4.7C13.9 4.5 14 4.2 14 4C14 2.9 13.1 2 12 2C10.9 2 10 2.9 10 4C10 4.2 10.1 4.5 10.2 4.7C6.6 5.8 4 9.1 4 13C4 16.9 6.6 20.2 10.2 21.3C10.1 21.5 10 21.8 10 22C10 23.1 10.9 24 12 24C13.1 24 14 23.1 14 22C14 21.8 13.9 21.5 13.8 21.3C17.4 20.2 20 16.9 20 13Z"/>
            </svg>
            <span className="font-bold text-gray-900 dark:text-gray-100">Support Helper</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Fermer la navigation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-6 space-y-1" aria-label="Menu principal">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-xl" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 border-t dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name || user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="ml-2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Se déconnecter"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800/20 sticky top-0 z-40 border-b border-transparent dark:border-gray-700">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={sidebarOpen}
              aria-controls="sidebar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <div className="flex-1 flex items-center justify-center px-8">
              <GlobalSearch />
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full" role="status" aria-label={`Rôle: ${user.role}`}>
                {user.role}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="px-4 sm:px-6 lg:px-8 py-8" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
