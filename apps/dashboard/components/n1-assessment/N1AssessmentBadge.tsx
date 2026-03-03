'use client';

import { useState } from 'react';
import type { N1Assessment } from '@/lib/types/ticket';
import { Badge, Button } from '@/components/ui';
import { n1TriageApi } from '@/lib/api/n1-triage';
import { ArrowUpRight, CheckCircle, Copy, Shield } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

const decisionConfig: Record<
  string,
  { label: string; variant: BadgeVariant; icon: typeof CheckCircle }
> = {
  no_fix_needed: { label: 'N1: No Fix Needed', variant: 'success', icon: CheckCircle },
  duplicate: { label: 'N1: Duplicate', variant: 'warning', icon: Copy },
  escalate_n2: { label: 'N1: Escalated to N2', variant: 'danger', icon: ArrowUpRight },
};

interface N1AssessmentBadgeProps {
  assessment: N1Assessment | null | undefined;
  decision: string | null | undefined;
  assessedAt: string | null | undefined;
  ticketId: string;
  onOverride?: () => void;
}

export function N1AssessmentBadge({
  assessment,
  decision,
  assessedAt,
  ticketId,
  onOverride,
}: N1AssessmentBadgeProps) {
  const [isOverriding, setIsOverriding] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!decision || !assessment) return null;

  const config = decisionConfig[decision] ?? {
    label: `N1: ${decision}`,
    variant: 'default' as BadgeVariant,
    icon: Shield,
  };
  const Icon = config.icon;

  const handleOverride = async () => {
    try {
      setIsOverriding(true);
      await n1TriageApi.overrideDecision(ticketId);
      onOverride?.();
    } catch (err) {
      console.error('Failed to override N1 decision:', err);
    } finally {
      setIsOverriding(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant={config.variant}>
            <Icon className="w-3 h-3 mr-1" aria-hidden="true" />
            {config.label}
          </Badge>
          <span className="text-xs text-gray-400">
            Confidence: {Math.round(assessment.confidence * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {assessedAt && (
            <span className="text-xs text-gray-400">
              {new Date(assessedAt).toLocaleString()}
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
          >
            {expanded ? 'Collapse' : 'Details'}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">{assessment.userResponse}</p>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Reasoning:
            </span>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              {assessment.reasoning}
            </p>
          </div>

          {assessment.duplicateTicketId && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Duplicate of:
              </span>
              <span className="text-xs text-blue-500 ml-1">
                {assessment.duplicateTicketId}
              </span>
            </div>
          )}

          {assessment.investigationHints && assessment.investigationHints.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Investigation hints:
              </span>
              <ul className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 list-disc pl-4">
                {assessment.investigationHints.map((hint, i) => (
                  <li key={i}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          {assessment.similarTicketIds && assessment.similarTicketIds.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Similar tickets:
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-300 ml-1">
                {assessment.similarTicketIds.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {decision !== 'escalate_n2' && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOverride}
            isLoading={isOverriding}
            className="flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            Forcer escalade N2
          </Button>
        </div>
      )}
    </div>
  );
}
