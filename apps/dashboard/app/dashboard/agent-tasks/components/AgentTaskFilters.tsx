'use client';

import type { AgentTaskFilters as FilterValues } from '@/lib/api/agent-tasks';
import { useTranslations } from 'next-intl';

interface AgentTaskFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onReset: () => void;
}

export function AgentTaskFiltersBar({ filters, onFiltersChange, onReset }: AgentTaskFiltersProps) {
  const t = useTranslations('agent.filters');
  const tStatuses = useTranslations('agent.taskStatuses');
  const tSeverities = useTranslations('tickets.severities');

  const statusOptions = [
    { value: '', label: t('allStatuses') },
    { value: 'analyzing', label: tStatuses('analyzing') },
    { value: 'plan_ready', label: tStatuses('plan_ready') },
    { value: 'plan_pending_review', label: tStatuses('plan_pending_review') },
    { value: 'plan_approved', label: tStatuses('plan_approved') },
    { value: 'generating', label: tStatuses('generating') },
    { value: 'code_ready', label: tStatuses('code_ready') },
    { value: 'code_pending_review', label: tStatuses('code_pending_review') },
    { value: 'code_approved', label: tStatuses('code_approved') },
    { value: 'pushing', label: tStatuses('pushing') },
    { value: 'pr_created', label: tStatuses('pr_created') },
    { value: 'completed', label: tStatuses('completed') },
    { value: 'failed', label: tStatuses('failed') },
    { value: 'expired', label: tStatuses('expired') },
  ];

  const severityOptions = [
    { value: '', label: t('allSeverities') },
    { value: 'critical', label: tSeverities('critical') },
    { value: 'high', label: tSeverities('high') },
    { value: 'medium', label: tSeverities('medium') },
    { value: 'low', label: tSeverities('low') },
  ];

  const hasActiveFilters =
    filters.status || filters.severity || filters.search || filters.dateFrom || filters.dateTo;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('search')}
          </label>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={filters.search || ''}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value, page: 1 })}
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Status */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('status')}
          </label>
          <select
            value={filters.status || ''}
            onChange={e =>
              onFiltersChange({ ...filters, status: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('severity')}
          </label>
          <select
            value={filters.severity || ''}
            onChange={e =>
              onFiltersChange({ ...filters, severity: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {severityOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('from')}
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={e =>
              onFiltersChange({ ...filters, dateFrom: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Date To */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('to')}
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={e =>
              onFiltersChange({ ...filters, dateTo: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {t('clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
}
