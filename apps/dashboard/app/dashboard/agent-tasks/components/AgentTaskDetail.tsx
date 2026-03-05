'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { AgentTask, ActionPlan, ExecutionLogEntry } from '@/lib/api/agent-tasks';
import type { TicketSeverity } from '@/lib/types/ticket';
import { AgentTaskStatusBadge } from './AgentTaskStatusBadge';
import { SeverityBadge } from '@/components/ui';

interface AgentTaskDetailProps {
  task: AgentTask;
  isLive?: boolean;
}

type TabId = 'overview' | 'plan' | 'logs' | 'timeline';

interface TabDef {
  id: TabId;
  label: string;
}

const IN_PROGRESS_STATUSES: string[] = [
  'analyzing',
  'generating',
  'plan_approved',
  'code_approved',
  'pushing',
];

const TERMINAL_STATUSES: string[] = ['completed', 'failed', 'expired'];

function isInProgress(status: string): boolean {
  return IN_PROGRESS_STATUSES.includes(status);
}

function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function logStepColor(step: string): string {
  if (step.startsWith('analysis_') || step === 'analysis') return 'text-cyan-400';
  if (step.startsWith('plan_') || step === 'plan') return 'text-blue-400';
  if (
    step.startsWith('code_') ||
    step.startsWith('generate_') ||
    step === 'code' ||
    step === 'generate'
  )
    return 'text-purple-400';
  if (step === 'error') return 'text-red-400';
  return 'text-gray-400';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`;
  if (diffMs < 3600000)
    return `${Math.round(diffMs / 60000)}m ${Math.round((diffMs % 60000) / 1000)}s`;
  return `${Math.round(diffMs / 3600000)}h ${Math.round((diffMs % 3600000) / 60000)}m`;
}

// ---- Tab: Overview ----
function OverviewTab({ task, isLive }: { task: AgentTask; isLive?: boolean }) {
  return (
    <div className="space-y-6">
      {/* In-progress banner */}
      {isLive && isInProgress(task.status) && (
        <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/50 rounded-lg px-4 py-3">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="text-sm text-blue-300 font-medium">
            Agent is working — live updates active
          </span>
        </div>
      )}

      {/* Ticket Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Linked Ticket</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Link
              href={`/dashboard/tickets/${task.ticketId}`}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {task.ticket?.title || 'Untitled Ticket'}
            </Link>
            {task.ticket?.severity && (
              <SeverityBadge severity={task.ticket.severity as TicketSeverity} />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">ID: {task.ticketId}</p>
        </div>
      </div>

      {/* Task Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoItem label="Status" value={<AgentTaskStatusBadge status={task.status} />} />
        <InfoItem label="Application" value={task.application?.name || '-'} />
        <InfoItem label="Created" value={formatDate(task.createdAt)} />
        <InfoItem label="Started" value={formatDate(task.startedAt)} />
        <InfoItem label="Completed" value={formatDate(task.completedAt)} />
        <InfoItem label="Duration" value={formatDuration(task.startedAt, task.completedAt)} />
        <InfoItem label="Retry Count" value={String(task.retryCount)} />
        {task.branchName && <InfoItem label="Branch" value={task.branchName} />}
      </div>

      {/* PR Info */}
      {task.prUrl && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
            Pull Request
          </h4>
          <a
            href={task.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            PR #{task.prNumber} - View on GitHub
          </a>
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">Error</h4>
          <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono">
            {task.error}
          </pre>
        </div>
      )}

      {/* CI Error Log */}
      {task.ciErrorLog && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
            CI Error Log
          </h4>
          <pre className="text-sm text-orange-700 dark:text-orange-400 whitespace-pre-wrap font-mono">
            {task.ciErrorLog}
          </pre>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="text-sm text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

// ---- Tab: Action Plan ----
function PlanTab({ plan }: { plan: ActionPlan | null }) {
  if (!plan) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No action plan generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Summary</h4>
        <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          {plan.summary}
        </p>
      </div>

      {/* Root Cause */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Root Cause</h4>
        <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          {plan.rootCause}
        </p>
      </div>

      {/* Complexity */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Estimated Complexity:
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            plan.estimatedComplexity === 'low'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : plan.estimatedComplexity === 'medium'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          {plan.estimatedComplexity}
        </span>
      </div>

      {/* Files to Change */}
      {plan.files && plan.files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Files to Change ({plan.files.length})
          </h4>
          <div className="space-y-2">
            {plan.files
              .sort((a, b) => a.order - b.order)
              .map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      file.operation === 'create'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : file.operation === 'delete'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}
                  >
                    {file.operation}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
                      {file.filePath}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {file.description}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {file.changeType.replace('_', ' ')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Testing Strategy */}
      {plan.testingStrategy && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Testing Strategy
          </h4>
          <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            {plan.testingStrategy}
          </p>
        </div>
      )}

      {/* Risks */}
      {plan.risks && plan.risks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risks</h4>
          <ul className="list-disc list-inside space-y-1">
            {plan.risks.map((risk, idx) => (
              <li key={idx} className="text-sm text-gray-900 dark:text-gray-100">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Tab: Execution Logs ----
function LogsTab({ logs, isLive }: { logs: ExecutionLogEntry[]; isLive?: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logs.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length]);

  if (!logs || logs.length === 0) {
    if (isLive) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500 dark:text-gray-400">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <span className="text-sm">Waiting for first logs...</span>
        </div>
      );
    }
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No execution logs yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {logs.map((entry, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 font-mono text-sm"
        >
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">
            {entry.timestamp
              ? new Date(entry.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '-'}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-700 ${logStepColor(entry.step)}`}
          >
            {entry.step}
          </span>
          <span className="text-gray-900 dark:text-gray-100 flex-1">{entry.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ---- Tab: Timeline ----
function TimelineTab({ task }: { task: AgentTask }) {
  const statusOrder: { status: string; label: string }[] = [
    { status: 'analyzing', label: 'Analysis Started' },
    { status: 'plan_ready', label: 'Plan Ready' },
    { status: 'plan_pending_review', label: 'Plan Pending Review' },
    { status: 'plan_approved', label: 'Plan Approved' },
    { status: 'generating', label: 'Code Generation' },
    { status: 'code_ready', label: 'Code Ready' },
    { status: 'code_pending_review', label: 'Code Pending Review' },
    { status: 'code_approved', label: 'Code Approved' },
    { status: 'pushing', label: 'Pushing to Git' },
    { status: 'pr_created', label: 'PR Created' },
    { status: 'completed', label: 'Completed' },
  ];

  const currentIdx = statusOrder.findIndex(s => s.status === task.status);
  const isFailed = task.status === 'failed' || task.status === 'expired';

  return (
    <div className="relative">
      <div className="space-y-0">
        {statusOrder.map((step, idx) => {
          const isPast = idx <= currentIdx && !isFailed;
          const isCurrent = idx === currentIdx && !isFailed;
          const isFutureOrSkipped = idx > currentIdx || isFailed;

          return (
            <div key={step.status} className="flex items-start gap-4 relative">
              {/* Connector line */}
              {idx < statusOrder.length - 1 && (
                <div
                  className={`absolute left-[11px] top-6 w-0.5 h-full ${
                    isPast && !isCurrent
                      ? 'bg-green-400 dark:bg-green-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}

              {/* Dot */}
              <div
                className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-500'
                    : isPast
                      ? 'border-green-500 bg-green-500'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                }`}
              >
                {isPast && !isCurrent && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {isCurrent && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </div>

              {/* Content */}
              <div className={`pb-8 ${isFutureOrSkipped ? 'opacity-40' : ''}`}>
                <p
                  className={`text-sm font-medium ${
                    isCurrent
                      ? 'text-blue-600 dark:text-blue-400'
                      : isPast
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}

        {/* Failed/Expired state */}
        {isFailed && (
          <div className="flex items-start gap-4 relative">
            <div className="relative z-10 w-6 h-6 rounded-full border-2 border-red-500 bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {task.status === 'expired' ? 'Expired' : 'Failed'}
              </p>
              {task.error && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">{task.error}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Component ----
export function AgentTaskDetail({ task, isLive = false }: AgentTaskDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'plan', label: 'Action Plan' },
    {
      id: 'logs',
      label: isLive && !isTerminal(task.status) ? 'Execution Logs' : 'Execution Logs',
    },
    { id: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
              {tab.id === 'logs' && isLive && !isTerminal(task.status) && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white animate-pulse">
                  LIVE
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab task={task} isLive={isLive} />}
        {activeTab === 'plan' && <PlanTab plan={task.actionPlan} />}
        {activeTab === 'logs' && (
          <LogsTab logs={task.executionLog} isLive={isLive && !isTerminal(task.status)} />
        )}
        {activeTab === 'timeline' && <TimelineTab task={task} />}
      </div>
    </div>
  );
}

export { isInProgress, isTerminal };
