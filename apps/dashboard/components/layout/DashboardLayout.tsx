/**
 * Dashboard Layout
 * Layout principal avec sidebar et header
 */

'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { ConnectionStatus } from '@/components/layout/ConnectionStatus';
import { SkipLink } from '@/components/ui/SkipLink';
import { SdkWidget } from '@/components/layout/SdkWidget';
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { Sheet } from '@/components/ui/Sheet';
import {
  LayoutDashboard,
  Ticket,
  Bot,
  AppWindow,
  Plug,
  Github,
  BarChart3,
  Settings,
  Bug,
  Puzzle,
  X,
  Menu,
  LogOut,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: 'nav.main',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { href: '/dashboard/tickets', labelKey: 'nav.tickets', icon: Ticket },
      { href: '/dashboard/agent-tasks', labelKey: 'nav.agentTasks', icon: Bot },
    ],
  },
  {
    titleKey: 'nav.configuration',
    items: [
      { href: '/dashboard/applications', labelKey: 'nav.applications', icon: AppWindow },
      { href: '/dashboard/integrations', labelKey: 'nav.integrations', icon: Plug },
      { href: '/dashboard/github', labelKey: 'nav.github', icon: Github },
    ],
  },
  {
    titleKey: 'nav.reports',
    items: [{ href: '/dashboard/analytics', labelKey: 'nav.analytics', icon: BarChart3 }],
  },
  {
    titleKey: 'nav.tools',
    items: [
      { href: '/dashboard/sdk-demo', labelKey: 'nav.sdkDemo', icon: Puzzle },
      { href: '/dashboard/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const t = useTranslations();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { isConnected, error: socketError } = useTicketSocket();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  if (!user) {
    return null;
  }

  const NavSections = () => (
    <nav className="px-4 py-6 flex-1 overflow-y-auto" aria-label={t('nav.mainNav')}>
      {navSections.map((section, sectionIndex) => (
        <div key={section.titleKey} className={sectionIndex > 0 ? 'mt-6' : ''}>
          <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t(section.titleKey as any)}
          </p>
          <div className="space-y-1">
            {section.items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span>{t(item.labelKey as any)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <Bug className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span className="font-bold text-gray-900 dark:text-gray-100">Support Helper</span>
        </Link>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label={t('nav.closeMenu')}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <NavSections />

      {/* User Info */}
      <div className="border-t dark:border-gray-700 p-4 mt-auto">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {user.name || user.email}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.role}</p>
          </div>
          <button
            onClick={() => logout()}
            className="ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            title={t('nav.signOut')}
            aria-label={t('nav.signOut')}
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SkipLink />

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 shadow-lg dark:shadow-gray-800/20"
        aria-label={t('nav.principalNav')}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobile && (
        <Sheet isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} side="left">
          <SidebarContent />
        </Sheet>
      )}

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-800/20 sticky top-0 z-40 border-b border-transparent dark:border-gray-700">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded lg:hidden"
                aria-label={t('nav.openMenu')}
                aria-expanded={sidebarOpen}
                aria-controls="sidebar"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>
            )}

            <div className="flex-1 flex items-center justify-center px-2 sm:px-8">
              <GlobalSearch />
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <ConnectionStatus isConnected={isConnected} error={socketError} />
              <LanguageSelector />
              <ThemeToggle />
              <span
                className="hidden sm:inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full"
                role="status"
                aria-label={t('nav.role', { role: user.role })}
              >
                {user.role}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* SDK Bug Report Widget */}
      <SdkWidget />

      {/* Mobile Overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
