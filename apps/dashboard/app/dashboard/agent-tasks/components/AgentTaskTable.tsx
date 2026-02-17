'use client';

import Link from 'next/link';
import type { AgentTask } from '@/lib/api/agent-tasks';
import type { TicketSeverity } from '@/lib/types/ticket';
import { AgentTaskStatusBadge } from './AgentTaskStatusBadge';
import { SeverityBadge, EmptyState } from '@/components/ui';
import { Bot } from 'lucide-react';

interface AgentTaskTableProps {
  tasks: AgentTask[];
  isLoading: boolean;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m`;
  return `${Math.round(diffMs / 3600000)}h ${Math.round((diffMs % 3600000) / 60000)}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AgentTaskTable({ tasks, isLoading, onRetry, onCancel }: AgentTaskTableProps) {
  if (isLoading && tasks.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agent tasks...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon="🤖"
          title="No agent tasks found"
          description="Agent tasks will appear here when tickets are analyzed by the AI agent. Make sure you have tickets submitted and the AI agent is enabled."
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Ticket
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              App
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Severity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              PR
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {tasks.map((task) => {
            const isTerminal = ['completed', 'failed', 'expired'].includes(task.status);
            const canRetry = ['failed', 'expired'].includes(task.status);

            return (
              <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/agent-tasks/${task.id}`}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline block truncate max-w-[250px]"
                    title={task.ticket?.title || 'Untitled'}
                  >
                    {task.ticket?.title || 'Untitled Ticket'}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[250px]">
                    {task.id.slice(0, 8)}...
                  </p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {task.application?.name || '-'}
                </td>
                <td className="px-4 py-3">
                  <AgentTaskStatusBadge status={task.status} />
                </td>
                <td className="px-4 py-3">
                  {task.ticket?.severity ? (
                    <SeverityBadge severity={task.ticket.severity as TicketSeverity} />
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {formatDate(task.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {formatDuration(task.startedAt, task.completedAt)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {task.prUrl ? (
                    <a
                      href={task.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      #{task.prNumber}
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/dashboard/agent-tasks/${task.id}`}
                      className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      View
                    </Link>
                    {canRetry && (
                      <button
                        onClick={() => onRetry(task.id)}
                        className="px-2 py-1 text-xs rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                    {!isTerminal && (
                      <button
                        onClick={() => onCancel(task.id)}
                        className="px-2 py-1 text-xs rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
