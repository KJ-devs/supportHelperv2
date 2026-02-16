import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  variant?: 'default' | 'compact';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  variant = 'default',
  className,
  ...props
}: EmptyStateProps) {
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      window.location.href = actionHref;
    }
  };

  const iconSize = variant === 'compact' ? 'h-8 w-8' : 'h-12 w-12';
  const paddingClass = variant === 'compact' ? 'py-8' : 'py-12';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        paddingClass,
        className
      )}
      {...props}
    >
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className={cn(iconSize, 'text-muted-foreground')} />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && (
        <Button onClick={handleAction} size={variant === 'compact' ? 'sm' : 'default'}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
