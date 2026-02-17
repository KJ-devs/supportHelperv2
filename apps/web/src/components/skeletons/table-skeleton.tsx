import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  /** Column width patterns to prevent layout shift */
  columnWidths?: string[];
}

export function TableSkeleton({
  columns = 6,
  rows = 8,
  columnWidths,
}: TableSkeletonProps) {
  const widths = columnWidths || generateDefaultWidths(columns);

  return (
    <div className="rounded-md border">
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b">
            {widths.map((width, i) => (
              <th
                key={i}
                className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
              >
                <Skeleton className={`h-4 ${width}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {widths.map((_, colIndex) => (
                <td key={colIndex} className="p-4 align-middle">
                  <SkeletonCell colIndex={colIndex} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonCell({ colIndex }: { colIndex: number }) {
  // Vary the skeleton shapes per column for a more realistic look
  switch (colIndex) {
    case 0: // ID column
      return <Skeleton className="h-4 w-16" />;
    case 1: // Title column
      return (
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      );
    case 2: // Status badge
      return <Skeleton className="h-6 w-20 rounded-full" />;
    case 3: // Priority
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-14" />
        </div>
      );
    case 4: // Avatar + name
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      );
    case 5: // Date
      return <Skeleton className="h-4 w-20" />;
    default:
      return <Skeleton className="h-4 w-full" />;
  }
}

function generateDefaultWidths(columns: number): string[] {
  const defaults = ['w-16', 'w-48', 'w-20', 'w-16', 'w-24', 'w-20', 'w-8'];
  return Array.from({ length: columns }, (_, i) => defaults[i] || 'w-20');
}

/** Skeleton for the tickets table specifically matching the TicketsDataTable columns */
export function TicketsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b">
            <th className="h-12 w-[40px] px-4">
              <Skeleton className="h-4 w-4" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-8" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-10" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-14" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-10" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="h-12 px-4 text-left">
              <Skeleton className="h-4 w-14" />
            </th>
            <th className="h-12 w-[50px] px-4" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b">
              <td className="p-4">
                <Skeleton className="h-4 w-4" />
              </td>
              <td className="p-4">
                <Skeleton className="h-4 w-16 font-mono" />
              </td>
              <td className="p-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[140px]" />
                </div>
              </td>
              <td className="p-4">
                <Skeleton className="h-6 w-20 rounded-full" />
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              </td>
              <td className="p-4">
                <Skeleton className="h-5 w-16 rounded-md" />
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </td>
              <td className="p-4">
                <Skeleton className="h-4 w-20" />
              </td>
              <td className="p-4">
                <Skeleton className="h-8 w-8 rounded-md" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
