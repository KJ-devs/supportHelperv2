/**
 * Export Button Component
 * Bouton d'export avec menu dropdown
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import type { Ticket, TicketFilters } from '@/lib/types/ticket';

interface ExportButtonProps {
  tickets: Ticket[];
  filters?: TicketFilters;
  onExport?: (format: 'csv' | 'json') => void;
}

export function ExportButton({ tickets, filters, onExport }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const exportToCSV = () => {
    setIsExporting(true);

    try {
      // CSV Headers
      const headers = [
        'ID',
        'Titre',
        'Description',
        'Status',
        'Type',
        'Sévérité',
        'Application',
        'Créé le',
        'Mis à jour le',
      ];

      // CSV Rows
      const rows = tickets.map((ticket) => [
        ticket.id,
        `"${ticket.title.replace(/"/g, '""')}"`,
        `"${ticket.description.replace(/"/g, '""')}"`,
        ticket.status,
        ticket.type,
        ticket.severity,
        ticket.application?.name || '',
        ticket.createdAt,
        ticket.updatedAt,
      ]);

      // Build CSV
      const csv = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tickets-export-${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onExport) {
        onExport('csv');
      }
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Erreur lors de l\'export CSV');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);

    try {
      // Build JSON with metadata
      const data = {
        exportDate: new Date().toISOString(),
        filters,
        totalTickets: tickets.length,
        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          status: ticket.status,
          type: ticket.type,
          severity: ticket.severity,
          application: ticket.application?.name || null,
          userContext: ticket.userContext,
          aiSummary: ticket.aiSummary,
          keywords: ticket.keywords,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        })),
      };

      // Download
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tickets-export-${Date.now()}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onExport) {
        onExport('json');
      }
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      alert('Erreur lors de l\'export JSON');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting || tickets.length === 0}
      >
        {isExporting ? '⏳ Export...' : '📥 Exporter'}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={exportToCSV}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>📊</span>
              <div>
                <div className="font-medium">Exporter en CSV</div>
                <div className="text-xs text-gray-500">
                  Format tableur
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={exportToJSON}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span>📄</span>
              <div>
                <div className="font-medium">Exporter en JSON</div>
                <div className="text-xs text-gray-500">
                  Format développeur
                </div>
              </div>
            </div>
          </button>

          <div className="border-t my-1" />

          <div className="px-4 py-2 text-xs text-gray-500">
            {tickets.length} ticket(s) à exporter
          </div>
        </div>
      )}
    </div>
  );
}
