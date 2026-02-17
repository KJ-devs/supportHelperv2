import { type ReactNode } from 'react';
import { type LucideIcon, Inbox, Search, FileQuestion } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary/alternative action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 p-8 text-center',
        className
      )}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex gap-3">
          {action && (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/** Pre-configured empty state for "no search results" */
export function NoSearchResults({
  query,
  onClear,
  className,
}: {
  query?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        query
          ? `No items match "${query}". Try adjusting your search or filters.`
          : 'No items match your current filters. Try adjusting or clearing them.'
      }
      action={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
      className={className}
    />
  );
}

/** Pre-configured empty state for "not found" */
export function NotFoundState({
  title = 'Not found',
  description = 'The item you are looking for does not exist or has been removed.',
  onGoBack,
  className,
}: {
  title?: string;
  description?: string;
  onGoBack?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={FileQuestion}
      title={title}
      description={description}
      action={onGoBack ? { label: 'Go back', onClick: onGoBack } : undefined}
      className={className}
    />
  );
}
