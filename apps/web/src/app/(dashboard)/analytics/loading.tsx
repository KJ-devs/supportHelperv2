import { StatsGridSkeleton, ChartSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      <StatsGridSkeleton count={4} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton height={300} />
        <ChartSkeleton height={300} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartSkeleton height={250} />
        <ChartSkeleton height={250} />
        <ChartSkeleton height={250} />
      </div>
    </div>
  );
}
