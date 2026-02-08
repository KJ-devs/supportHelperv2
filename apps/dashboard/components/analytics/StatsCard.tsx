/**
 * Stats Card Component
 * Carte affichant une statistique avec icône
 */

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-gray-50 text-gray-900',
  primary: 'bg-blue-50 text-blue-900',
  success: 'bg-green-50 text-green-900',
  warning: 'bg-yellow-50 text-yellow-900',
  danger: 'bg-red-50 text-red-900',
};

export function StatsCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  variant = 'default',
}: StatsCardProps) {
  return (
    <div className={`rounded-lg p-6 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl">{icon}</span>
        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
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
