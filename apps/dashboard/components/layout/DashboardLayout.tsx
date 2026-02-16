/**
 * Dashboard Layout
 * Layout principal avec sidebar et header
 */

'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Sheet } from '@/components/ui/Sheet';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/agent-tasks', label: 'Agent Tasks', icon: Bot },
  { href: '/dashboard/applications', label: 'Applications', icon: AppWindow },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  { href: '/dashboard/github', label: 'GitHub', icon: Github },
  { href: '/dashboard/analytics', label: 'Analytiques', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Paramètres', icon: Settings },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  if (!user) {
    return null;
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <span className="text-2xl">🐛</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">Support Helper</span>
        </Link>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Fermer le menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-4 py-6 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
          </div>
          <button
            onClick={() => logout()}
            className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-50 bg-white dark:bg-gray-900 shadow-lg dark:shadow-gray-800/20 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64`}
        aria-label="Navigation principale"
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobile && (
        <Sheet isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} side="left">
          <div className="flex flex-col h-full">
            <SidebarContent />
          </div>
        </Sheet>
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen && !isMobile ? 'lg:ml-64' : ''}`}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800/20 sticky top-0 z-40 border-b border-transparent dark:border-gray-700">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {sidebarOpen && !isMobile ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            <div className="flex-1 flex items-center justify-center px-2 sm:px-8">
              <GlobalSearch />
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              <span className="hidden sm:inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
                {user.role}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
