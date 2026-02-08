'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FacetItem {
  value: string;
  label: string;
  count: number;
}

interface FacetGroup {
  name: string;
  label: string;
  items: FacetItem[];
}

interface TicketFacetsSidebarProps {
  facets: {
    status?: Record<string, number>;
    priority?: Record<string, number>;
    type?: Record<string, number>;
  } | null;
  selectedFilters: {
    status?: string;
    priority?: string;
    type?: string;
  };
  onFilterChange: (facet: string, value: string | null) => void;
  isLoading?: boolean;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING: 'Waiting',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const TYPE_LABELS: Record<string, string> = {
  QUESTION: 'Question',
  BUG: 'Bug',
  FEATURE: 'Feature Request',
  FEEDBACK: 'Feedback',
  OTHER: 'Other',
};

export function TicketFacetsSidebar({
  facets,
  selectedFilters,
  onFilterChange,
  isLoading = false,
  className,
}: TicketFacetsSidebarProps) {
  const facetGroups: FacetGroup[] = React.useMemo(() => {
    if (!facets) return [];

    const groups: FacetGroup[] = [];

    if (facets.status && Object.keys(facets.status).length > 0) {
      groups.push({
        name: 'status',
        label: 'Status',
        items: Object.entries(facets.status).map(([value, count]) => ({
          value,
          label: STATUS_LABELS[value] || value,
          count,
        })),
      });
    }

    if (facets.priority && Object.keys(facets.priority).length > 0) {
      groups.push({
        name: 'priority',
        label: 'Priority',
        items: Object.entries(facets.priority).map(([value, count]) => ({
          value,
          label: PRIORITY_LABELS[value] || value,
          count,
        })),
      });
    }

    if (facets.type && Object.keys(facets.type).length > 0) {
      groups.push({
        name: 'type',
        label: 'Type',
        items: Object.entries(facets.type).map(([value, count]) => ({
          value,
          label: TYPE_LABELS[value] || value,
          count,
        })),
      });
    }

    return groups;
  }, [facets]);

  if (isLoading) {
    return (
      <div className={cn('space-y-6 p-4', className)}>
        {['Status', 'Priority', 'Type'].map(label => (
          <div key={label} className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="space-y-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (facetGroups.length === 0) {
    return (
      <div className={cn('p-4 text-sm text-muted-foreground', className)}>No facets available</div>
    );
  }

  return (
    <div className={cn('space-y-6 p-4', className)}>
      {facetGroups.map(group => {
        const selectedValue = selectedFilters[group.name as keyof typeof selectedFilters];

        return (
          <div key={group.name} className="space-y-2">
            <h4 className="text-sm font-semibold">{group.label}</h4>
            <div className="space-y-1">
              {group.items.map(item => {
                const isSelected = selectedValue === item.value;

                return (
                  <button
                    key={item.value}
                    onClick={() => {
                      onFilterChange(group.name, isSelected ? null : item.value);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                      isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <span>{item.label}</span>
                    <Badge
                      variant={isSelected ? 'secondary' : 'outline'}
                      className="ml-auto text-xs"
                    >
                      {item.count.toLocaleString()}
                    </Badge>
                  </button>
                );
              })}
            </div>
            {selectedValue && (
              <button
                onClick={() => onFilterChange(group.name, null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear filter
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
