'use client';

import { CheckCircle2, Circle, Clock, XCircle, ListChecks, ThumbsUp, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentMessage } from './useAgentChat';

interface ActionStep {
  description: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  filePath?: string;
}

interface ActionPlanMetadata {
  steps?: ActionStep[];
  totalSteps?: number;
  overallStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface ActionPlanCardProps {
  message: AgentMessage;
  onApprove: (messageId: string) => Promise<void>;
  onReject: (messageId: string) => Promise<void>;
}

const stepStatusIcon = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

export function ActionPlanCard({ message, onApprove, onReject }: ActionPlanCardProps) {
  const meta = (message.metadata ?? {}) as ActionPlanMetadata;
  const steps = meta.steps ?? [];
  const overallStatus = meta.overallStatus ?? 'pending';
  const isPending = message.actionState === 'pending' || message.actionState == null;
  const isApproved = message.actionState === 'approved';
  const isRejected = message.actionState === 'rejected';

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Action Plan
          </CardTitle>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
              overallStatus === 'completed' && 'border-green-200 bg-green-100 text-green-700',
              overallStatus === 'in_progress' && 'border-blue-200 bg-blue-100 text-blue-700',
              overallStatus === 'failed' && 'border-red-200 bg-red-100 text-red-700',
              overallStatus === 'pending' && 'border-muted bg-muted text-muted-foreground'
            )}
          >
            {overallStatus.replace('_', ' ')}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">No steps defined.</p>
        )}
        <ol className="space-y-2">
          {steps.map((step, index) => {
            const status = step.status ?? 'pending';
            const icon = stepStatusIcon[status] ?? stepStatusIcon.pending;
            return (
              <li
                key={index}
                className={cn(
                  'flex items-start gap-3 rounded-lg p-2.5',
                  status === 'completed' && 'bg-green-50',
                  status === 'in_progress' && 'bg-blue-50',
                  status === 'failed' && 'bg-red-50',
                  status === 'pending' && 'bg-muted/50'
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold shadow-sm">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm leading-relaxed">{step.description}</p>
                  {step.filePath && (
                    <p className="font-mono text-xs text-muted-foreground">{step.filePath}</p>
                  )}
                </div>
                <div className="shrink-0">{icon}</div>
              </li>
            );
          })}
        </ol>
      </CardContent>

      <CardFooter className="gap-2 border-t pt-4">
        {isApproved && (
          <div className="flex w-full items-center justify-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Plan approved
          </div>
        )}
        {isRejected && (
          <div className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4" />
            Changes requested
          </div>
        )}
        {isPending && (
          <>
            <Button
              className="flex-1 gap-2 bg-green-600 text-white hover:bg-green-700"
              onClick={() => onApprove(message.id)}
            >
              <ThumbsUp className="h-4 w-4" />
              Approve Plan
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
              onClick={() => onReject(message.id)}
            >
              <RotateCcw className="h-4 w-4" />
              Request Changes
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
