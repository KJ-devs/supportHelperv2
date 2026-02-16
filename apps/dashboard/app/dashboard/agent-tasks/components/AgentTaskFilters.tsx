'use client';

import type { AgentTaskFilters as FilterValues } from '@/lib/api/agent-tasks';

interface AgentTaskFiltersProps {
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  onReset: () => void;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'analyzing', label: 'Analyzing' },
  { value: 'plan_ready', label: 'Plan Ready' },
  { value: 'plan_approved', label: 'Plan Approved' },
  { value: 'generating', label: 'Generating' },
  { value: 'code_ready', label: 'Code Ready' },
  { value: 'pushing', label: 'Pushing' },
  { value: 'pr_created', label: 'PR Created' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

const severityOptions = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function AgentTaskFiltersBar({ filters, onFiltersChange, onReset }: AgentTaskFiltersProps) {
  const hasActiveFilters =
    filters.status || filters.severity || filters.search || filters.dateFrom || filters.dateTo;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by ticket title..."
            value={filters.search || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Status */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, status: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Severity
          </label>
          <select
            value={filters.severity || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, severity: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            {severityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, dateFrom: e.target.value || undefined, page: 1 })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Date To */}
        <div className="w-40">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            To
          </label>
          <input
            type="date"
            value={filters.dateTo || ''}
            onChange={(e) =>
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
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
