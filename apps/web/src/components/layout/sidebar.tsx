'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Ticket,
  BarChart3,
  Settings,
  Github,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/stores/sidebar-store';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'GitHub', href: '/github', icon: Github },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  currentPath: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const { isCollapsed, toggle } = useSidebarStore();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <HelpCircle className="h-8 w-8 text-primary" />
            <span className="font-bold text-lg">Support</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn(isCollapsed && 'mx-auto')}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navigation.map(item => {
          const isActive =
            currentPath === item.href ||
            (item.href !== '/dashboard' && currentPath.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">© 2026 Support Helper</p>
        </div>
      )}
    </aside>
  );
}
