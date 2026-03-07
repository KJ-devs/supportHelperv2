'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AgentTask, DiagnosisSnapshot } from '@/lib/api/agent-tasks';
import type { TicketSeverity } from '@/lib/types/ticket';
import { AgentTaskStatusBadge } from './AgentTaskStatusBadge';
import { AgentTaskLogs } from './AgentTaskLogs';
import { SeverityBadge } from '@/components/ui';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface AgentTaskDetailProps {
  task: AgentTask;
  isLive?: boolean;
}

type TabId = 'overview' | 'diagnosis' | 'logs' | 'timeline';

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
        <InfoItem
          label="Status"
          value={
            <div data-testid="agent-task-status-badge">
              <AgentTaskStatusBadge status={task.status} />
            </div>
          }
        />
        <InfoItem label="Application" value={task.application?.name || '-'} />
        <InfoItem label="Created" value={formatDate(task.createdAt)} />
        <InfoItem label="Started" value={formatDate(task.startedAt)} />
        <InfoItem label="Completed" value={formatDate(task.completedAt)} />
        <InfoItem
          label="Duration"
          value={
            <span data-testid="agent-task-duration">
              {formatDuration(task.startedAt, task.completedAt)}
            </span>
          }
        />
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
        <div
          data-testid="agent-task-error"
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
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

      {/* Execution Logs (inline terminal) */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Execution Logs</h3>
          {isLive && isInProgress(task.status) && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium">Live</span>
            </span>
          )}
        </div>
        <div className="h-64 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
          <AgentTaskLogs
            taskId={task.id}
            isActive={isLive && isInProgress(task.status)}
            initialLogs={task.executionLog ?? []}
          />
        </div>
      </div>
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

// ---- Tab: Diagnosis ----
function DiagnosisTab({
  diagnosis,
  executionLog,
}: {
  diagnosis: DiagnosisSnapshot | null;
  executionLog: AgentTask['executionLog'];
}) {
  // If no formal diagnosis snapshot, try to extract from execution logs
  if (!diagnosis) {
    const conclusionEntry = executionLog.find(e => e.step === 'conclusion');
    const thinkingEntries = executionLog.filter(e => e.step === 'thinking');
    const lastThinking =
      thinkingEntries.length > 0 ? thinkingEntries[thinkingEntries.length - 1] : null;
    const diagEntry = executionLog.find(e => e.step === 'update_diagnosis');

    if (!conclusionEntry && !lastThinking && !diagEntry) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No diagnosis available yet.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Source:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Extracted from logs
          </span>
        </div>
        {diagEntry && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Diagnosis Tool Call
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <MarkdownRenderer content={String(diagEntry.message)} />
              {typeof diagEntry.detail === 'string' && diagEntry.detail && (
                <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <MarkdownRenderer content={diagEntry.detail} className="text-xs" />
                </div>
              )}
            </div>
          </div>
        )}
        {conclusionEntry && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Agent Conclusion
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <MarkdownRenderer
                content={String(conclusionEntry.detail || conclusionEntry.message)}
              />
            </div>
          </div>
        )}
        {!conclusionEntry && lastThinking && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Last Agent Reasoning
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <MarkdownRenderer content={String(lastThinking.detail || lastThinking.message)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const confidencePercent = Math.round(diagnosis.confidence * 100);
  const confidenceColor =
    confidencePercent >= 70
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : confidencePercent >= 40
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';

  return (
    <div className="space-y-6">
      {/* Confidence */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Confidence:</span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColor}`}
        >
          {confidencePercent}%
        </span>
      </div>

      {/* Root Cause */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Root Cause</h4>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <MarkdownRenderer content={diagnosis.rootCause} />
        </div>
      </div>

      {/* Suggested Fix */}
      {diagnosis.suggestedFix && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Suggested Fix
          </h4>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
            <MarkdownRenderer content={diagnosis.suggestedFix} />
          </div>
        </div>
      )}

      {/* Affected Files */}
      {diagnosis.affectedFiles && diagnosis.affectedFiles.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Affected Files ({diagnosis.affectedFiles.length})
          </h4>
          <div className="space-y-2">
            {diagnosis.affectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    file.relevance === 'primary'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {file.relevance}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
                    {file.filePath}
                  </p>
                  {file.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {file.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Timeline helpers ----

function formatStepDuration(ms: number): string {
  if (ms < 60000) return `+${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `+${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  return `+${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
}

function getCodegenFiles(executionLog: AgentTask['executionLog']): string[] {
  const files: string[] = [];
  for (const e of executionLog) {
    if (e.step === 'codegen_file' && typeof e.filePath === 'string') {
      files.push(e.filePath as string);
    }
    // V2 agentic loop emits tool names as step — write_file and edit_file include file path in toolInput
    if ((e.step === 'write_file' || e.step === 'edit_file') && e.toolInput) {
      const ti = e.toolInput as Record<string, unknown>;
      const fp = (ti.file_path as string) || (ti.path as string);
      if (fp) files.push(fp);
    }
  }
  return files;
}

interface DerivedTimelineStep {
  key: string;
  label: string;
  status: 'done' | 'current' | 'skipped';
  timestamp?: string;
  detail?: string;
}

/**
 * Build a data-driven timeline from execution logs.
 * Instead of a fixed V1 pipeline, this detects which phases actually occurred.
 */
function buildDerivedTimeline(task: AgentTask): DerivedTimelineStep[] {
  const logs = task.executionLog ?? [];
  const steps: DerivedTimelineStep[] = [];

  // 1) Analysis started
  const analysisStart = logs.find(e => e.step === 'analysis_started');
  if (analysisStart || task.startedAt) {
    steps.push({
      key: 'analysis',
      label: 'Analysis',
      status: 'done',
      timestamp: (analysisStart?.timestamp as string) || task.startedAt || undefined,
    });
  }

  // 2) Investigation — count read/search tool calls
  const investigationCalls = logs.filter(e =>
    [
      'read_file',
      'list_directory',
      'get_repo_structure',
      'get_file_history',
      'get_file_blame',
      'search_code',
      'search_codebase_semantic',
      'get_ticket_details',
      'search_similar_tickets',
    ].includes(e.step)
  );
  if (investigationCalls.length > 0) {
    steps.push({
      key: 'investigation',
      label: 'Investigation',
      status: 'done',
      detail: `${investigationCalls.length} tool calls`,
      timestamp: investigationCalls[0]?.timestamp as string,
    });
  }

  // 3) Diagnosis / Plan
  const diagnosisCalls = logs.filter(e => e.step === 'update_diagnosis');
  if (diagnosisCalls.length > 0) {
    const lastDiag = diagnosisCalls[diagnosisCalls.length - 1];
    steps.push({
      key: 'diagnosis',
      label: 'Diagnosis',
      status: 'done',
      timestamp: lastDiag?.timestamp as string,
      detail: (lastDiag?.resultPreview as string) || undefined,
    });
  } else if (task.diagnosisSnapshot) {
    steps.push({
      key: 'diagnosis',
      label: 'Diagnosis',
      status: 'done',
      detail: `confidence: ${Math.round(task.diagnosisSnapshot.confidence * 100)}%`,
    });
  }

  // 4) Code Generation — write_file / edit_file
  const codeGenCalls = logs.filter(e => ['write_file', 'edit_file'].includes(e.step));
  if (codeGenCalls.length > 0) {
    steps.push({
      key: 'codegen',
      label: 'Code Generation',
      status: 'done',
      timestamp: codeGenCalls[0]?.timestamp as string,
      detail: `${codeGenCalls.length} file(s) modified`,
    });
  }

  // 5) Branch creation
  const branchCall = logs.find(e => e.step === 'create_branch');
  if (branchCall || task.branchName) {
    steps.push({
      key: 'branch',
      label: 'Branch Created',
      status: 'done',
      timestamp: branchCall?.timestamp as string,
      detail: task.branchName || (branchCall?.message as string) || undefined,
    });
  }

  // 6) PR creation
  const prCall = logs.find(e => e.step === 'create_pull_request');
  if (prCall || task.prUrl) {
    steps.push({
      key: 'pr',
      label: 'Pull Request',
      status: 'done',
      timestamp: prCall?.timestamp as string,
      detail: task.prUrl ? `PR #${task.prNumber}` : (prCall?.message as string) || undefined,
    });
  }

  // 7) Final status
  if (task.status === 'completed') {
    steps.push({
      key: 'completed',
      label: 'Completed',
      status: 'done',
      timestamp: task.completedAt || undefined,
    });
  } else if (task.status === 'failed' || task.status === 'expired') {
    steps.push({
      key: 'failed',
      label: task.status === 'expired' ? 'Expired' : 'Failed',
      status: 'done',
    });
  } else {
    // Task is still in progress — add a "current" step
    const lastLog = logs[logs.length - 1];
    steps.push({
      key: 'in_progress',
      label: task.status === 'analyzing' ? 'Analyzing...' : task.status,
      status: 'current',
      timestamp: lastLog?.timestamp as string,
    });
  }

  return steps;
}

// ---- Tab: Timeline ----
function TimelineTab({ task }: { task: AgentTask }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const codegenFiles = getCodegenFiles(task.executionLog ?? []);
  const derivedSteps = buildDerivedTimeline(task);

  function toggleStep(key: string) {
    setExpandedStep(prev => (prev === key ? null : key));
  }

  function renderExpandedContent(step: DerivedTimelineStep): React.ReactNode {
    switch (step.key) {
      case 'analysis':
        return (
          <div className="space-y-2">
            {task.startedAt && (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Started at <span className="font-medium">{formatDate(task.startedAt)}</span>
              </p>
            )}
          </div>
        );

      case 'investigation': {
        const logs = task.executionLog ?? [];
        const toolCalls = logs.filter(e =>
          [
            'read_file',
            'list_directory',
            'get_repo_structure',
            'search_code',
            'search_codebase_semantic',
          ].includes(e.step)
        );
        return (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {toolCalls.map((e, i) => (
              <p key={i} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {String(e.message)}
                {typeof e.resultPreview === 'string' && e.resultPreview && (
                  <span className="ml-2 text-gray-400 dark:text-gray-500">({e.resultPreview})</span>
                )}
              </p>
            ))}
          </div>
        );
      }

      case 'diagnosis':
        return task.diagnosisSnapshot ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Confidence:{' '}
              <span className="text-gray-900 dark:text-gray-100">
                {Math.round(task.diagnosisSnapshot.confidence * 100)}%
              </span>
            </p>
            <div className="line-clamp-4">
              <MarkdownRenderer content={task.diagnosisSnapshot.rootCause} />
            </div>
            {task.diagnosisSnapshot.suggestedFix && (
              <div className="line-clamp-3">
                <MarkdownRenderer content={task.diagnosisSnapshot.suggestedFix} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Diagnosis generated from final analysis.
          </p>
        );

      case 'codegen':
        return codegenFiles.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Modified files ({codegenFiles.length})
            </p>
            <ul className="space-y-0.5 max-h-32 overflow-y-auto">
              {codegenFiles.map((f, i) => (
                <li key={i} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">{step.detail}</p>
        );

      case 'branch':
        return task.branchName ? (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Branch:{' '}
            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
              {task.branchName}
            </span>
          </p>
        ) : null;

      case 'pr':
        return (
          <div className="space-y-2">
            {task.prUrl && (
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                PR #{task.prNumber} — View on GitHub
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        );

      case 'completed':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Duration:{' '}
              <span className="font-medium">
                {formatDuration(task.startedAt, task.completedAt)}
              </span>
            </p>
            {task.diagnosisSnapshot && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Diagnosis confidence: {Math.round(task.diagnosisSnapshot.confidence * 100)}%
              </p>
            )}
          </div>
        );

      case 'failed':
        return task.error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <pre className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono">
              {task.error}
            </pre>
          </div>
        ) : null;

      default:
        return step.detail ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{step.detail}</p>
        ) : null;
    }
  }

  return (
    <div className="relative">
      <div className="space-y-0">
        {derivedSteps.map((step, idx) => {
          const isDone = step.status === 'done';
          const isCurrent = step.status === 'current';
          const isFailed = step.key === 'failed';
          const isExpanded = expandedStep === step.key;

          // Duration: time from this step's timestamp to next step's timestamp
          let durationBadge: string | null = null;
          if (step.timestamp && idx < derivedSteps.length - 1) {
            const nextTs = derivedSteps[idx + 1]?.timestamp;
            if (nextTs) {
              const diff = new Date(nextTs).getTime() - new Date(step.timestamp).getTime();
              if (diff > 0) durationBadge = formatStepDuration(diff);
            }
          }

          return (
            <div
              key={step.key}
              data-testid={`timeline-step-${step.key}`}
              className="flex items-start gap-4 relative"
            >
              {/* Connector line */}
              {idx < derivedSteps.length - 1 && (
                <div
                  className={`absolute left-[11px] top-6 w-0.5 h-full ${
                    isDone && !isFailed
                      ? 'bg-green-400 dark:bg-green-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}

              {/* Dot */}
              <div
                className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isFailed
                    ? 'border-red-500 bg-red-500'
                    : isCurrent
                      ? 'border-blue-500 bg-blue-500'
                      : isDone
                        ? 'border-green-500 bg-green-500'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                }`}
              >
                {isDone && !isFailed && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {isFailed && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {isCurrent && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <button
                  onClick={() => toggleStep(step.key)}
                  className="flex items-center gap-2 text-left w-full cursor-pointer"
                >
                  <p
                    className={`text-sm font-medium ${
                      isFailed
                        ? 'text-red-600 dark:text-red-400'
                        : isCurrent
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.detail && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                      {step.detail}
                    </span>
                  )}
                  {durationBadge && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full font-mono">
                      {durationBadge}
                    </span>
                  )}
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mt-2">
                    {renderExpandedContent(step)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Main Component ----
export function AgentTaskDetail({ task, isLive = false }: AgentTaskDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'diagnosis', label: 'Diagnosis' },
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
              data-testid={`agent-task-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
              {tab.id === 'logs' && isLive && !isTerminal(task.status) && (
                <span
                  data-testid="agent-task-live-badge"
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white animate-pulse"
                >
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
        {activeTab === 'diagnosis' && (
          <DiagnosisTab diagnosis={task.diagnosisSnapshot} executionLog={task.executionLog ?? []} />
        )}
        {activeTab === 'logs' && (
          <div className="h-[520px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <AgentTaskLogs
              taskId={task.id}
              isActive={isLive && !isTerminal(task.status)}
              initialLogs={task.executionLog ?? []}
            />
          </div>
        )}
        {activeTab === 'timeline' && <TimelineTab task={task} />}
      </div>
    </div>
  );
}

export { isInProgress, isTerminal };
