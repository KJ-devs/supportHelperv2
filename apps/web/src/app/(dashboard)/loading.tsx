import { StatsGridSkeleton, ChartSkeleton, ContentCardSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <StatsGridSkeleton count={4} />

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <ChartSkeleton height={300} />
        </div>
        <div className="lg:col-span-3">
          <ContentCardSkeleton lines={5} />
        </div>
      </div>

      <ContentCardSkeleton lines={4} />
    </div>
  );
}
