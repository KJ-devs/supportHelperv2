import { type Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Support analytics and insights',
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
