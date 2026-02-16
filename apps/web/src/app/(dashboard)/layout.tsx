'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar currentPath={pathname} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main id="main-content" className="flex-1 overflow-auto p-6" role="main">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
