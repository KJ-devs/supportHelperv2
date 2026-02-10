'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Filter, X, CalendarIcon, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TicketStatus, TicketPriority, User } from '@/types';
import type { TicketFiltersState } from '@/stores/ticket-table-store';

interface AdvancedFiltersProps {
  filters: TicketFiltersState;
  onStatusChange: (status: TicketStatus | 'all') => void;
  onPriorityChange: (priority: TicketPriority | 'all') => void;
  onTypeChange: (type: string | 'all') => void;
  onAssigneeChange: (assigneeId: string | 'all' | 'unassigned') => void;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  onReset: () => void;
  assignees?: User[];
  className?: string;
}

const STATUSES: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITIES: { value: TicketPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'QUESTION', label: 'Question' },
  { value: 'BUG', label: 'Bug' },
  { value: 'FEATURE', label: 'Feature Request' },
  { value: 'FEEDBACK', label: 'Feedback' },
  { value: 'OTHER', label: 'Other' },
];

export function AdvancedFilters({
  filters,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
  onAssigneeChange,
  onDateRangeChange,
  onReset,
  assignees = [],
  className,
}: AdvancedFiltersProps) {
  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(
    filters.dateRange.from ? parseISO(filters.dateRange.from) : undefined
  );
  const [dateTo, setDateTo] = React.useState<Date | undefined>(
    filters.dateRange.to ? parseISO(filters.dateRange.to) : undefined
  );

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.priority !== 'all') count++;
    if (filters.type !== 'all') count++;
    if (filters.assigneeId !== 'all') count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    return count;
  }, [filters]);

  const handleDateFromSelect = (date: Date | undefined) => {
    setDateFrom(date);
    onDateRangeChange(date ? date.toISOString() : null, filters.dateRange.to);
  };

  const handleDateToSelect = (date: Date | undefined) => {
    setDateTo(date);
    onDateRangeChange(filters.dateRange.from, date ? date.toISOString() : null);
  };

  const clearDateRange = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    onDateRangeChange(null, null);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Status filter */}
      <Select
        value={filters.status}
        onValueChange={value => onStatusChange(value as TicketStatus | 'all')}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(status => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={filters.priority}
        onValueChange={value => onPriorityChange(value as TicketPriority | 'all')}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map(priority => (
            <SelectItem key={priority.value} value={priority.value}>
              {priority.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Type filter */}
      <Select value={filters.type} onValueChange={value => onTypeChange(value)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {TYPES.map(type => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      <Select
        value={filters.assigneeId}
        onValueChange={value => onAssigneeChange(value as string | 'all' | 'unassigned')}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All assignees</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {assignees.map(user => (
            <SelectItem key={user.id} value={user.id}>
              {user.name || user.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date range filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !dateFrom && !dateTo && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateFrom && dateTo ? (
              <>
                {format(dateFrom, 'MMM d')} - {format(dateTo, 'MMM d')}
              </>
            ) : dateFrom ? (
              <>From {format(dateFrom, 'MMM d')}</>
            ) : dateTo ? (
              <>Until {format(dateTo, 'MMM d')}</>
            ) : (
              'Date range'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex gap-2 p-3">
            <div>
              <p className="mb-2 text-sm font-medium">From</p>
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={handleDateFromSelect}
                initialFocus
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">To</p>
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={handleDateToSelect}
                disabled={date => (dateFrom ? date < dateFrom : false)}
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <div className="border-t p-3">
              <Button variant="ghost" size="sm" onClick={clearDateRange}>
                <X className="mr-2 h-4 w-4" />
                Clear dates
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Active filters badge and reset */}
      {activeFilterCount > 0 && (
        <>
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFilterCount} active
          </Badge>
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </>
      )}
    </div>
  );
}
