/**
 * Ticket Filters Component
 */

'use client';

import { useState } from 'react';
import { Select, Input, Button } from '@/components/ui';
import type { TicketFilters as Filters } from '@/lib/types/ticket';
import { useTranslations } from 'next-intl';

interface TicketFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
}

export function TicketFilters({ filters, onFiltersChange, onReset }: TicketFiltersProps) {
  const t = useTranslations('tickets');
  const [search, setSearch] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search, page: 1 });
  };

  const handleFilterChange = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow dark:shadow-gray-800/20 space-y-4">
      <form onSubmit={handleSearchSubmit}>
        <Input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label={t('filterStatus')}
          placeholder={t('allStatuses')}
          value={(filters.status as string) || ''}
          onChange={e => handleFilterChange('status', e.target.value)}
          options={[
            { value: '', label: t('all') },
            { value: 'new', label: t('statuses.new') },
            { value: 'open', label: t('statuses.open') },
            { value: 'in_progress', label: t('statuses.inProgress') },
            { value: 'resolved', label: t('statuses.resolved') },
            { value: 'closed', label: t('statuses.closed') },
          ]}
        />

        <Select
          label={t('filterType')}
          placeholder={t('allTypes')}
          value={(filters.type as string) || ''}
          onChange={e => handleFilterChange('type', e.target.value)}
          options={[
            { value: '', label: t('all') },
            { value: 'bug', label: `🐛 ${t('types.bug')}` },
            { value: 'crash', label: `💥 ${t('types.crash')}` },
            { value: 'performance', label: `⚡ ${t('types.performance')}` },
            { value: 'ui', label: `🎨 ${t('types.ui')}` },
            { value: 'feature_request', label: `✨ ${t('types.featureRequest')}` },
            { value: 'other', label: `📝 ${t('types.other')}` },
          ]}
        />

        <Select
          label={t('filterSeverity')}
          placeholder={t('allSeverities')}
          value={(filters.severity as string) || ''}
          onChange={e => handleFilterChange('severity', e.target.value)}
          options={[
            { value: '', label: t('all') },
            { value: 'critical', label: `🔴 ${t('severities.critical')}` },
            { value: 'high', label: `🟠 ${t('severities.high')}` },
            { value: 'medium', label: `🟡 ${t('severities.medium')}` },
            { value: 'low', label: `🟢 ${t('severities.low')}` },
          ]}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t('resetFilters')}
        </Button>
        <Button size="sm" onClick={handleSearchSubmit}>
          {t('applyFilters')}
        </Button>
      </div>
    </div>
  );
}
