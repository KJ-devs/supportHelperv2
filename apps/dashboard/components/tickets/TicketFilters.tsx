/**
 * Ticket Filters Component
 * Filtres pour la liste des tickets
 */

'use client';

import { useState } from 'react';
import { Select, Input, Button } from '@/components/ui';
import type { TicketFilters as Filters } from '@/lib/types/ticket';

interface TicketFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onReset: () => void;
}

export function TicketFilters({ filters, onFiltersChange, onReset }: TicketFiltersProps) {
  const [search, setSearch] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search, page: 1 });
  };

  const handleFilterChange = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-4">
      {/* Search */}
      <form onSubmit={handleSearchSubmit}>
        <Input
          type="text"
          placeholder="Rechercher des tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Filter */}
        <Select
          label="Statut"
          placeholder="Tous les statuts"
          value={filters.status as string || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          options={[
            { value: '', label: 'Tous' },
            { value: 'new', label: 'Nouveau' },
            { value: 'open', label: 'Ouvert' },
            { value: 'in_progress', label: 'En cours' },
            { value: 'resolved', label: 'Résolu' },
            { value: 'closed', label: 'Fermé' },
          ]}
        />

        {/* Type Filter */}
        <Select
          label="Type"
          placeholder="Tous les types"
          value={filters.type as string || ''}
          onChange={(e) => handleFilterChange('type', e.target.value)}
          options={[
            { value: '', label: 'Tous' },
            { value: 'bug', label: '🐛 Bug' },
            { value: 'crash', label: '💥 Crash' },
            { value: 'performance', label: '⚡ Performance' },
            { value: 'ui', label: '🎨 Interface' },
            { value: 'feature_request', label: '✨ Fonctionnalité' },
            { value: 'other', label: '📝 Autre' },
          ]}
        />

        {/* Severity Filter */}
        <Select
          label="Sévérité"
          placeholder="Toutes les sévérités"
          value={filters.severity as string || ''}
          onChange={(e) => handleFilterChange('severity', e.target.value)}
          options={[
            { value: '', label: 'Toutes' },
            { value: 'critical', label: '🔴 Critique' },
            { value: 'high', label: '🟠 Élevée' },
            { value: 'medium', label: '🟡 Moyenne' },
            { value: 'low', label: '🟢 Faible' },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Réinitialiser
        </Button>
        <Button size="sm" onClick={handleSearchSubmit}>
          Appliquer
        </Button>
      </div>
    </div>
  );
}
