'use client';

import { AlertTriangle, FileCode, Lightbulb, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentMessage } from './useAgentChat';

interface DiagnosisMetadata {
  rootCause?: string;
  confidence?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affectedFiles?: string[];
  suggestedFix?: string;
}

interface DiagnosisCardProps {
  message: AgentMessage;
}

const severityConfig = {
  low: {
    border: 'border-l-blue-400',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Low',
  },
  medium: {
    border: 'border-l-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    label: 'Medium',
  },
  high: {
    border: 'border-l-orange-400',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    label: 'High',
  },
  critical: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700 border-red-200',
    label: 'Critical',
  },
};

export function DiagnosisCard({ message }: DiagnosisCardProps) {
  const meta = (message.metadata ?? {}) as DiagnosisMetadata;
  const severity = meta.severity ?? 'medium';
  const config = severityConfig[severity] ?? severityConfig.medium;
  const confidence = meta.confidence ?? 0;
  const affectedFiles = meta.affectedFiles ?? [];

  return (
    <Card className={cn('border-l-4 shadow-sm', config.border)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Diagnosis
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              config.badge
            )}
          >
            {config.label} severity
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Root cause */}
        {meta.rootCause && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Root Cause
            </p>
            <p className="text-sm leading-relaxed">{meta.rootCause}</p>
          </div>
        )}

        {/* Confidence bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Confidence
            </span>
            <span className="text-xs font-semibold">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                confidence >= 0.8
                  ? 'bg-green-500'
                  : confidence >= 0.5
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              )}
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
        </div>

        {/* Affected files */}
        {affectedFiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <FileCode className="h-3.5 w-3.5" />
              Affected Files
            </p>
            <ul className="space-y-1">
              {affectedFiles.map(file => (
                <li
                  key={file}
                  className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 font-mono text-xs"
                >
                  <FileCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                  {file}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested fix */}
        {meta.suggestedFix && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Suggested Fix
            </p>
            <div className="rounded-md bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
              {meta.suggestedFix}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
