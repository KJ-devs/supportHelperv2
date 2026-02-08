/**
 * Bulk Actions Component
 * Actions en masse sur plusieurs tickets sélectionnés
 */

'use client';

import { useState } from 'react';
import { Button, Select } from '@/components/ui';
import type { TicketStatus } from '@/lib/types/ticket';
import { ticketsApi } from '@/lib/api/tickets';

interface BulkActionsProps {
  selectedTickets: string[];
  onComplete: () => void;
  onCancel: () => void;
}

export function BulkActions({ selectedTickets, onComplete, onCancel }: BulkActionsProps) {
  const [action, setAction] = useState<'status' | 'delete' | ''>('');
  const [newStatus, setNewStatus] = useState<TicketStatus>('open');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBulkUpdateStatus = async () => {
    if (!newStatus) return;

    if (!confirm(`Modifier le statut de ${selectedTickets.length} ticket(s) ?`)) {
      return;
    }

    setIsProcessing(true);

    try {
      // Update all tickets
      await Promise.all(
        selectedTickets.map((id) => ticketsApi.updateStatus(id, newStatus))
      );

      alert(`✅ ${selectedTickets.length} ticket(s) mis à jour !`);
      onComplete();
    } catch (error) {
      console.error('Bulk update error:', error);
      alert('Erreur lors de la mise à jour en masse');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `⚠️ ATTENTION !\n\nSupprimer définitivement ${selectedTickets.length} ticket(s) ?\n\nCette action est irréversible.`
      )
    ) {
      return;
    }

    setIsProcessing(true);

    try {
      // Delete all tickets
      await Promise.all(
        selectedTickets.map((id) => ticketsApi.deleteTicket(id))
      );

      alert(`✅ ${selectedTickets.length} ticket(s) supprimé(s) !`);
      onComplete();
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Erreur lors de la suppression en masse');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = () => {
    if (action === 'status') {
      handleBulkUpdateStatus();
    } else if (action === 'delete') {
      handleBulkDelete();
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
          </svg>
          <span className="font-medium text-blue-900">
            {selectedTickets.length} ticket(s) sélectionné(s)
          </span>
        </div>

        {/* Action Selector */}
        <Select
          value={action}
          onChange={(e) => setAction(e.target.value as any)}
          disabled={isProcessing}
          options={[
            { value: '', label: 'Choisir une action...' },
            { value: 'status', label: 'Changer le statut' },
            { value: 'delete', label: 'Supprimer' },
          ]}
        />

        {/* Status Selector (if action is status) */}
        {action === 'status' && (
          <Select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
            disabled={isProcessing}
            options={[
              { value: 'new', label: 'Nouveau' },
              { value: 'open', label: 'Ouvert' },
              { value: 'in_progress', label: 'En cours' },
              { value: 'resolved', label: 'Résolu' },
              { value: 'closed', label: 'Fermé' },
            ]}
          />
        )}

        {/* Delete Warning (if action is delete) */}
        {action === 'delete' && (
          <span className="text-sm text-red-600 font-medium">
            ⚠️ Action irréversible !
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Annuler
          </Button>
          <Button
            variant={action === 'delete' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleExecute}
            disabled={!action || isProcessing}
            isLoading={isProcessing}
          >
            {isProcessing
              ? 'Traitement...'
              : action === 'delete'
              ? 'Supprimer'
              : 'Appliquer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
