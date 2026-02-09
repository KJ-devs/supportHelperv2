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

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/dashboard/tickets', label: 'Tickets', icon: '🎫' },
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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white shadow-lg transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="text-2xl">🐛</span>
            <span className="font-bold text-gray-900">Support Helper</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 border-t p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name || user.email}</p>
              <p className="text-xs text-gray-500 truncate">{user.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="ml-2 text-gray-500 hover:text-gray-700"
              title="Se déconnecter"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              {sidebarOpen ? '◀' : '☰'}
            </button>

            <div className="flex-1 flex items-center justify-center px-8">
              <GlobalSearch />
            </div>

            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                {user.role}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
