/**
 * EmptyState Component
 * Reusable empty state component for list views
 */

import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  variant?: 'default' | 'bordered';
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  variant = 'default',
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16',
  };

  const iconSizes = {
    sm: 'text-4xl mb-3',
    md: 'text-6xl mb-4',
    lg: 'text-8xl mb-6',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const variantClasses =
    variant === 'bordered'
      ? 'border border-dashed border-gray-300 dark:border-gray-600 rounded-2xl'
      : '';

  return (
    <div
      className={`text-center ${sizeClasses[size]} ${variantClasses} bg-white dark:bg-gray-800`}
    >
      {icon && (
        <div className={`${iconSizes[size]} flex items-center justify-center`}>
          {typeof icon === 'string' ? (
            <span>{icon}</span>
          ) : (
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
      )}

      <h3
        className={`font-semibold text-gray-900 dark:text-white mb-2 ${titleSizes[size]}`}
      >
        {title}
      </h3>

      {description && (
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}

      {actionLabel && (onAction || actionHref) && (
        <>
          {actionHref ? (
            <a href={actionHref}>
              <Button>{actionLabel}</Button>
            </a>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </>
      )}
    </div>
  );
}
