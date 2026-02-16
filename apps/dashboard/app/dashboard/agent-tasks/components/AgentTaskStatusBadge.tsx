'use client';

import type { AgentTaskStatus } from '@/lib/api/agent-tasks';

interface AgentTaskStatusBadgeProps {
  status: AgentTaskStatus;
}

const statusConfig: Record<AgentTaskStatus, { label: string; className: string }> = {
  analyzing: {
    label: 'Analyzing',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  plan_ready: {
    label: 'Plan Ready',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  plan_pending_review: {
    label: 'Plan Review',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  plan_approved: {
    label: 'Plan Approved',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  generating: {
    label: 'Generating',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  code_ready: {
    label: 'Code Ready',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  },
  code_pending_review: {
    label: 'Code Review',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  code_approved: {
    label: 'Code Approved',
    className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  pushing: {
    label: 'Pushing',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  },
  pr_created: {
    label: 'PR Created',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  },
  expired: {
    label: 'Expired',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  },
};

export function AgentTaskStatusBadge({ status }: AgentTaskStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.analyzing;
  const isAnimated = ['analyzing', 'generating', 'pushing', 'plan_pending_review', 'code_pending_review'].includes(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {isAnimated && (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
