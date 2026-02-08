'use client';

import * as React from 'react';
import { type ColumnDef, type SortingState, type RowSelectionState } from '@tanstack/react-table';
import { formatDistanceToNow, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  ExternalLink,
  Copy,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TicketWithRelations } from '@/hooks/use-tickets-advanced';
import type { TicketStatus, TicketPriority } from '@/types';

interface TicketsDataTableProps {
  data: TicketWithRelations[];
  isLoading?: boolean;
  // Sorting
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  // Selection
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  // Actions
  onView?: (ticket: TicketWithRelations) => void;
  onEdit?: (ticket: TicketWithRelations) => void;
  onDelete?: (ticket: TicketWithRelations) => void;
  onAssign?: (ticket: TicketWithRelations) => void;
  // Virtualization
  enableVirtualization?: boolean;
  virtualRowHeight?: number;
}

const STATUS_STYLES: Record<TicketStatus, { color: string; bg: string }> = {
  open: { color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  resolved: { color: 'text-green-700', bg: 'bg-green-100' },
  closed: { color: 'text-gray-700', bg: 'bg-gray-100' },
};

const PRIORITY_STYLES: Record<TicketPriority, { color: string; bg: string; dot: string }> = {
  low: { color: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  medium: { color: 'text-blue-600', bg: 'bg-blue-100', dot: 'bg-blue-400' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100', dot: 'bg-orange-400' },
  urgent: { color: 'text-red-600', bg: 'bg-red-100', dot: 'bg-red-500' },
};

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email?.slice(0, 2).toUpperCase() || '??';
}

export function TicketsDataTable({
  data,
  isLoading = false,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  onView,
  onEdit,
  onDelete,
  onAssign,
  enableVirtualization = false,
  virtualRowHeight = 64,
}: TicketsDataTableProps) {
  const router = useRouter();

  const columns: ColumnDef<TicketWithRelations>[] = React.useMemo(
    () => [
      {
        id: 'id',
        accessorKey: 'id',
        header: 'ID',
        size: 100,
        cell: ({ row }) => {
          const id = row.original.id;
          const shortId = id.slice(0, 8);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(id);
                    }}
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    #{shortId}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to copy ID</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: 'Title',
        size: 300,
        cell: ({ row }) => {
          const ticket = row.original;
          return (
            <div className="flex flex-col gap-1">
              <Link
                href={`/tickets/${ticket.id}`}
                onClick={e => e.stopPropagation()}
                className="font-medium hover:underline"
              >
                {ticket.title}
              </Link>
              {ticket.description && (
                <p className="line-clamp-1 text-xs text-muted-foreground">{ticket.description}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        cell: ({ row }) => {
          const status = row.original.status as TicketStatus;
          const styles = STATUS_STYLES[status] || STATUS_STYLES.open;
          return (
            <Badge variant="outline" className={cn(styles.bg, styles.color, 'border-0')}>
              {status.replace('_', ' ')}
            </Badge>
          );
        },
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Priority',
        size: 100,
        cell: ({ row }) => {
          const priority = row.original.priority as TicketPriority;
          const styles = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
          return (
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', styles.dot)} />
              <span className={cn('text-sm', styles.color)}>{priority}</span>
            </div>
          );
        },
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Type',
        size: 100,
        cell: ({ row }) => {
          const category = row.original.category;
          return (
            <Badge variant="secondary" className="font-normal">
              {category}
            </Badge>
          );
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        size: 150,
        cell: ({ row }) => {
          const customer = row.original.customer;
          if (!customer) return <span className="text-muted-foreground">-</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={customer.avatar || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(customer.name, customer.email)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{customer.name || customer.email}</span>
            </div>
          );
        },
      },
      {
        id: 'assignee',
        header: 'Assignee',
        size: 150,
        cell: ({ row }) => {
          const assignee = row.original.assignee;
          if (!assignee) {
            return (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={e => {
                  e.stopPropagation();
                  onAssign?.(row.original);
                }}
              >
                <UserPlus className="mr-1 h-3 w-3" />
                Assign
              </Button>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignee.avatar || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(assignee.name, assignee.email)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{assignee.name || assignee.email}</span>
            </div>
          );
        },
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Created',
        size: 120,
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="text-sm text-muted-foreground">
                  {formatDistanceToNow(date, { addSuffix: true })}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{format(date, 'PPpp')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 50,
        enableSorting: false,
        cell: ({ row }) => {
          const ticket = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onView?.(ticket)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit?.(ticket)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit ticket
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAssign?.(ticket)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(ticket.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy ID
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/tickets/${ticket.id}`)
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(ticket)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onView, onEdit, onDelete, onAssign]
  );

  const handleRowClick = (ticket: TicketWithRelations) => {
    router.push(`/tickets/${ticket.id}`);
  };

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      sorting={sorting}
      onSortingChange={updater => {
        const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
        onSortingChange(newSorting);
      }}
      manualSorting
      rowSelection={rowSelection}
      onRowSelectionChange={updater => {
        const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
        onRowSelectionChange(newSelection);
      }}
      enableRowSelection
      onRowClick={handleRowClick}
      getRowId={row => row.id}
      enableVirtualization={enableVirtualization}
      virtualRowHeight={virtualRowHeight}
      rowClassName={row => (row.priority === 'urgent' ? 'border-l-2 border-l-red-500' : '')}
    />
  );
}
