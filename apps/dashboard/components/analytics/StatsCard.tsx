/**
 * Stats Card Component
 * Carte affichant une statistique avec icône
 */

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string | LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-gray-50 text-gray-900 dark:bg-gray-800/50 dark:text-gray-100',
  primary: 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100',
  success: 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100',
  warning: 'bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100',
  danger: 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100',
};

export function StatsCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  variant = 'default',
}: StatsCardProps) {
  const Icon = typeof icon === 'string' ? null : icon;

  return (
    <div className={`rounded-lg p-6 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-2">
        {Icon ? (
          <Icon className="w-8 h-8" aria-hidden="true" />
        ) : (
          <span className="text-3xl">{icon}</span>
        )}
        {trend && (
          <span
            className={`text-sm font-medium flex items-center gap-1 ${
              trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {trend.isPositive ? <TrendingUp className="w-4 h-4" aria-hidden="true" /> : <TrendingDown className="w-4 h-4" aria-hidden="true" />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium opacity-75 mb-1">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-sm opacity-75 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
