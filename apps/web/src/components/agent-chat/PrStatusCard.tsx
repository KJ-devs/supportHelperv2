'use client';

import {
  GitPullRequest,
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AgentMessage } from './useAgentChat';

interface CiCheck {
  name: string;
  status: 'success' | 'failure' | 'pending' | 'skipped';
  url?: string;
}

interface PrStatusMetadata {
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  ciStatus?: 'success' | 'failure' | 'pending' | 'running';
  checks?: CiCheck[];
  title?: string;
}

interface PrStatusCardProps {
  message: AgentMessage;
}

const ciStatusConfig = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    badge: 'border-green-200 bg-green-100 text-green-700',
    label: 'Passing',
  },
  failure: {
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    badge: 'border-red-200 bg-red-100 text-red-700',
    label: 'Failing',
  },
  pending: {
    icon: <Clock className="h-4 w-4 text-yellow-500" />,
    badge: 'border-yellow-200 bg-yellow-100 text-yellow-700',
    label: 'Pending',
  },
  running: {
    icon: <Clock className="h-4 w-4 text-blue-500 animate-spin" />,
    badge: 'border-blue-200 bg-blue-100 text-blue-700',
    label: 'Running',
  },
};

const checkStatusIcon = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failure: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  pending: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  skipped: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
};

export function PrStatusCard({ message }: PrStatusCardProps) {
  const meta = (message.metadata ?? {}) as PrStatusMetadata;
  const ciStatus = meta.ciStatus ?? 'pending';
  const statusCfg = ciStatusConfig[ciStatus] ?? ciStatusConfig.pending;
  const checks = meta.checks ?? [];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            Pull Request
            {meta.prNumber != null && (
              <span className="text-muted-foreground">#{meta.prNumber}</span>
            )}
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              statusCfg.badge
            )}
          >
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* PR title + link */}
        {meta.prUrl && (
          <a
            href={meta.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <span className="flex-1 truncate">{meta.title ?? meta.prUrl}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
          </a>
        )}

        {/* Branch */}
        {meta.branch && (
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{meta.branch}</code>
          </div>
        )}

        {/* CI checks */}
        {checks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              CI Checks
            </p>
            <ul className="divide-y rounded-md border">
              {checks.map((check, index) => {
                const icon = checkStatusIcon[check.status] ?? checkStatusIcon.pending;
                return (
                  <li
                    key={index}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-sm">{check.name}</span>
                    </div>
                    {check.url && (
                      <a
                        href={check.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Details
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
