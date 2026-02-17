import { type Metadata } from 'next';
import { OverviewCards } from '@/components/dashboard/overview-cards';
import { RecentTickets } from '@/components/dashboard/recent-tickets';
import { TicketTrends } from '@/components/dashboard/ticket-trends';
import { QuickActions } from '@/components/dashboard/quick-actions';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Overview of your support operations',
};

export default function DashboardPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Overview of your support operations and key metrics.
        </p>
      </div>

      <OverviewCards />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <TicketTrends />
        </div>
        <div className="lg:col-span-3">
          <QuickActions />
        </div>
      </div>

      <RecentTickets />
    </div>
  );
}
