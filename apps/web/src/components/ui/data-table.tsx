'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type ColumnFiltersState,
  type VisibilityState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronUp, ChevronDown, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  // Sorting
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  // Selection
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  enableRowSelection?: boolean | ((row: any) => boolean);
  // Filtering
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  manualFiltering?: boolean;
  // Visibility
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>;
  // Virtualization
  enableVirtualization?: boolean;
  virtualRowHeight?: number;
  overscan?: number;
  // Callbacks
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData) => string;
  // Styling
  containerClassName?: string;
  tableClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  rowClassName?: string | ((row: TData) => string);
  cellClassName?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  // Sorting
  sorting,
  onSortingChange,
  manualSorting = true,
  // Selection
  rowSelection,
  onRowSelectionChange,
  enableRowSelection = false,
  // Filtering
  columnFilters,
  onColumnFiltersChange,
  manualFiltering = true,
  // Visibility
  columnVisibility,
  onColumnVisibilityChange,
  // Virtualization
  enableVirtualization = false,
  virtualRowHeight = 52,
  overscan = 10,
  // Callbacks
  onRowClick,
  getRowId,
  // Styling
  containerClassName,
  tableClassName,
  headerClassName,
  bodyClassName,
  rowClassName,
  cellClassName,
}: DataTableProps<TData, TValue>) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Build columns with selection if enabled
  const tableColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectColumn: ColumnDef<TData, TValue> = {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
          onClick={e => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    };

    return [selectColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    onSortingChange,
    onRowSelectionChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    manualSorting,
    manualFiltering,
    enableRowSelection,
    getRowId,
  });

  const { rows } = table.getRowModel();

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => virtualRowHeight,
    overscan,
    enabled: enableVirtualization,
  });

  const virtualRows = enableVirtualization ? rowVirtualizer.getVirtualItems() : null;
  const totalSize = enableVirtualization ? rowVirtualizer.getTotalSize() : 0;

  // Render loading skeleton
  if (isLoading) {
    return (
      <div className={cn('rounded-md border', containerClassName)}>
        <table className={cn('w-full caption-bottom text-sm', tableClassName)}>
          <thead className={cn('border-b bg-muted/50', headerClassName)}>
            <tr>
              {tableColumns.map((column, index) => (
                <th
                  key={index}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                >
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={bodyClassName}>
            {Array.from({ length: 10 }).map((_, index) => (
              <tr key={index} className="border-b">
                {tableColumns.map((column, colIndex) => (
                  <td key={colIndex} className="p-4 align-middle">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Render empty state
  if (rows.length === 0) {
    return (
      <div className={cn('rounded-md border', containerClassName)}>
        <table className={cn('w-full caption-bottom text-sm', tableClassName)}>
          <thead className={cn('border-b bg-muted/50', headerClassName)}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                    style={{ width: header.column.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            <tr>
              <td colSpan={tableColumns.length} className="h-24 text-center text-muted-foreground">
                No results found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // Render with virtualization
  if (enableVirtualization && virtualRows) {
    return (
      <div
        ref={tableContainerRef}
        className={cn('overflow-auto rounded-md border', containerClassName)}
        style={{ height: '600px' }}
      >
        <table className={cn('w-full caption-bottom text-sm', tableClassName)}>
          <thead className={cn('sticky top-0 z-10 border-b bg-background', headerClassName)}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHeader key={header.id} header={header} />
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            className={bodyClassName}
            style={{
              height: `${totalSize}px`,
              position: 'relative',
            }}
          >
            {virtualRows.map(virtualRow => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                    onRowClick && 'cursor-pointer',
                    typeof rowClassName === 'function' ? rowClassName(row.original) : rowClassName
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={cn('p-4 align-middle', cellClassName)}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Standard render without virtualization
  return (
    <div className={cn('overflow-auto rounded-md border', containerClassName)}>
      <table className={cn('w-full caption-bottom text-sm', tableClassName)}>
        <thead className={cn('border-b bg-muted/50', headerClassName)}>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHeader key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody className={bodyClassName}>
          {rows.map(row => (
            <tr
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
              onClick={() => onRowClick?.(row.original)}
              className={cn(
                'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                onRowClick && 'cursor-pointer',
                typeof rowClassName === 'function' ? rowClassName(row.original) : rowClassName
              )}
            >
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  className={cn('p-4 align-middle', cellClassName)}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Separate header component for sorting UI
function TableHeader({ header }: { header: any }) {
  const canSort = header.column.getCanSort();
  const sorted = header.column.getIsSorted();

  return (
    <th
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
        canSort && 'cursor-pointer select-none hover:bg-muted/50'
      )}
      style={{ width: header.column.getSize() }}
      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
    >
      <div className="flex items-center gap-2">
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {canSort && (
          <span className="ml-1">
            {sorted === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : sorted === 'desc' ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            )}
          </span>
        )}
      </div>
    </th>
  );
}

// Re-export for convenience
export type { ColumnDef, SortingState, RowSelectionState };
