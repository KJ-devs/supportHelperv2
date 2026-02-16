/**
 * UsageBar Component
 * Displays a single usage metric with a progress bar
 */

'use client';

interface UsageBarProps {
  label: string;
  current: number;
  limit: number | null;
  percentage: number;
}

export function UsageBar({ label, current, limit, percentage }: UsageBarProps) {
  const getColor = () => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatLimit = (limit: number | null): string => {
    return limit === null ? 'Unlimited' : limit.toLocaleString();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {current.toLocaleString()} / {formatLimit(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getColor()}`}
          style={{
            width: `${Math.min(percentage, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
