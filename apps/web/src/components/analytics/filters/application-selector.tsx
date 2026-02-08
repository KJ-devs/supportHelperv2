'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Application } from '@/types/analytics';

interface ApplicationSelectorProps {
  applications?: Application[];
  selectedApplicationId: string | null;
  onApplicationChange: (applicationId: string | null) => void;
  isLoading?: boolean;
}

export function ApplicationSelector({
  applications,
  selectedApplicationId,
  onApplicationChange,
  isLoading,
}: ApplicationSelectorProps) {
  if (isLoading) {
    return <Skeleton className="h-10 w-[200px]" />;
  }

  return (
    <Select
      value={selectedApplicationId || 'all'}
      onValueChange={value => onApplicationChange(value === 'all' ? null : value)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All Applications" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Applications</SelectItem>
        {applications?.map(app => (
          <SelectItem key={app.id} value={app.id}>
            {app.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
