'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ticketRelationsApi, type TicketRelation } from '@/lib/api/ticket-relations';
import type { TicketStatus } from '@/lib/types/ticket';
import { Badge, StatusBadge } from '@/components/ui';
import { ExternalLink, Link2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

const relationTypeConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  duplicate: { label: 'Duplicate', variant: 'warning' },
  similar: { label: 'Similar', variant: 'info' },
  related: { label: 'Related', variant: 'default' },
};

interface RelatedTicketsSectionProps {
  ticketId: string;
}

export function RelatedTicketsSection({ ticketId }: RelatedTicketsSectionProps) {
  const [relations, setRelations] = useState<TicketRelation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRelations = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ticketRelationsApi.getRelations(ticketId);
      setRelations(data);
    } catch (err) {
      console.error('Failed to fetch relations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  const handleDelete = async (relationId: string) => {
    try {
      setDeletingId(relationId);
      await ticketRelationsApi.deleteRelation(ticketId, relationId);
      setRelations((prev) => prev.filter((r) => r.id !== relationId));
    } catch (err) {
      console.error('Failed to delete relation:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return null;
  if (relations.length === 0) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Related Tickets
          </span>
          <span className="text-xs text-gray-400">({relations.length})</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {relations.map((rel) => {
            const config = relationTypeConfig[rel.relationType] ?? {
              label: rel.relationType,
              variant: 'default' as BadgeVariant,
            };
            const { relatedTicket } = rel;

            return (
              <div
                key={rel.id}
                className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2"
              >
                {/* Relation type badge */}
                <Badge variant={config.variant}>
                  {config.label}
                </Badge>

                {/* Ticket title link */}
                <Link
                  href={`/dashboard/tickets/${relatedTicket.id}`}
                  className="flex-1 text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                  title={relatedTicket.title ?? relatedTicket.id}
                >
                  {relatedTicket.title ?? relatedTicket.id.slice(0, 8)}
                </Link>

                {/* Status */}
                <StatusBadge status={relatedTicket.status as TicketStatus} />

                {/* Confidence */}
                {rel.confidence !== null && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {Math.round(rel.confidence * 100)}%
                  </span>
                )}

                {/* Fix info */}
                {relatedTicket.fix.prUrl && (
                  <a
                    href={relatedTicket.fix.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    PR #{relatedTicket.fix.prNumber}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {!relatedTicket.fix.prUrl && relatedTicket.fix.suggestedFix && (
                  <span
                    className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]"
                    title={relatedTicket.fix.suggestedFix}
                  >
                    {relatedTicket.fix.suggestedFix}
                  </span>
                )}

                {/* Source badge */}
                <span className="text-[10px] text-gray-400 uppercase">
                  {rel.createdBy}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(rel.id)}
                  disabled={deletingId === rel.id}
                  className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Remove relation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
