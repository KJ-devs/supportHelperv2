import { Skeleton } from '@/components/ui/skeleton';
import { TicketsTableSkeleton } from '@/components/skeletons';

export default function TicketsLoading() {
  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header skeleton */}
        <div className="border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-md" />
              <Skeleton className="h-10 w-10 rounded-md" />
              <Skeleton className="h-10 w-28 rounded-md" />
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <Skeleton className="h-10 w-80 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="flex-1 overflow-hidden p-6">
          <TicketsTableSkeleton rows={10} />
        </div>

        {/* Pagination skeleton */}
        <div className="border-t bg-background px-6 py-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
