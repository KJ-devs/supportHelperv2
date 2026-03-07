'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AgentTask, DiagnosisSnapshot } from '@/lib/api/agent-tasks';
import type { TicketSeverity } from '@/lib/types/ticket';
import { agentTasksApi } from '@/lib/api/agent-tasks';
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
  return new Date(dateStr).toLocaleString(undefined, {
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

/** Derive the current agent level from the last log entry that has agentLevel */
function deriveAgentLevel(task: AgentTask): string | null {
  const logs = task.executionLog ?? [];
  for (let i = logs.length - 1; i >= 0; i--) {
    const entry = logs[i];
    if (entry && typeof entry.agentLevel === 'string' && entry.agentLevel) {
      return entry.agentLevel;
    }
  }
  return null;
}

function AgentLevelBadge({
  level,
  n1Label,
  n2Label,
}: {
  level: string;
  n1Label: string;
  n2Label: string;
}) {
  if (level === 'N1') {
    return (
      <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
        {n1Label}
      </span>
    );
  }
  if (level === 'N2') {
    return (
      <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/50">
        {n2Label}
      </span>
    );
  }
  return null;
}

// ---- Tab: Overview ----
function OverviewTab({
  task,
  isLive,
  t,
}: {
  task: AgentTask;
  isLive?: boolean;
  t: ReturnType<typeof useTranslations<'agentTaskDetail'>>;
}) {
  const agentLevel = deriveAgentLevel(task);

  // Derive PR data from last create_pull_request log entry
  const prLogEntry = [...(task.executionLog ?? [])]
    .reverse()
    .find(e => e.step === 'create_pull_request');
  const prData = prLogEntry?.prData as
    | { number: number; url: string; title: string; reused?: boolean }
    | undefined;

  return (
    <div className="space-y-6">
      {/* In-progress banner */}
      {isLive && isInProgress(task.status) && (
        <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/50 rounded-lg px-4 py-3">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="text-sm text-blue-300 font-medium">{t('agentWorking')}</span>
        </div>
      )}

      {/* Ticket Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          {t('linkedTicket')}
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Link
              href={`/dashboard/tickets/${task.ticketId}`}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {task.ticket?.title || t('untitledTicket')}
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
          label={t('statusLabel')}
          value={
            <div
              className="flex items-center gap-2 flex-wrap"
              data-testid="agent-task-status-badge"
            >
              <AgentTaskStatusBadge status={task.status} />
              {agentLevel && (
                <AgentLevelBadge
                  level={agentLevel}
                  n1Label={t('n1FastTriage')}
                  n2Label={t('n2DeepAnalysis')}
                />
              )}
            </div>
          }
        />
        <InfoItem label={t('application')} value={task.application?.name || '-'} />
        <InfoItem label={t('created')} value={formatDate(task.createdAt)} />
        <InfoItem label={t('started')} value={formatDate(task.startedAt)} />
        <InfoItem label={t('completed')} value={formatDate(task.completedAt)} />
        <InfoItem
          label={t('duration')}
          value={
            <span data-testid="agent-task-duration">
              {formatDuration(task.startedAt, task.completedAt)}
            </span>
          }
        />
        <InfoItem label={t('retryCount')} value={String(task.retryCount)} />
        {task.branchName && <InfoItem label={t('branch')} value={task.branchName} />}
      </div>

      {/* PR Panel — enhanced */}
      {task.prUrl && (
        <div className="bg-gradient-to-r from-green-950/40 to-emerald-950/40 border border-green-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Git pull-request icon */}
              <svg
                className="w-6 h-6 text-green-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 11l3 3L22 4M6 4v6m0 0a3 3 0 110 6 3 3 0 010-6zm10-4v6m0 0a3 3 0 110 6 3 3 0 010-6z"
                />
              </svg>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-green-300">PR #{task.prNumber}</span>
                  {prData?.reused ? (
                    <span className="px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded-full border border-blue-700/50">
                      {t('prUpdated')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-green-900/50 text-green-300 rounded-full border border-green-700/50">
                      {t('prNew')}
                    </span>
                  )}
                </div>
                {prData?.title && <p className="text-sm text-gray-400 mt-0.5">{prData.title}</p>}
              </div>
            </div>
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('viewOnGitHub')}
            </a>
          </div>
          {task.branchName && (
            <div className="mt-3 text-xs text-gray-500">
              <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">{task.branchName}</span>
              <span className="mx-2">→</span>
              <span className="font-mono bg-gray-800 px-2 py-0.5 rounded">main</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {task.error && (
        <div
          data-testid="agent-task-error"
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
        >
          <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
            {t('errorTitle')}
          </h4>
          <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono">
            {task.error}
          </pre>
        </div>
      )}

      {/* CI Error Log */}
      {task.ciErrorLog && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
            {t('ciErrorLog')}
          </h4>
          <pre className="text-sm text-orange-700 dark:text-orange-400 whitespace-pre-wrap font-mono">
            {task.ciErrorLog}
          </pre>
        </div>
      )}

      {/* Execution Logs (inline terminal) */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('executionLogs')}
          </h3>
          {isLive && isInProgress(task.status) && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium">{t('live')}</span>
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

// ---- ActionPlanPanel ----
interface ActionPlanData {
  root_cause?: string;
  affected_files?: Array<{ file_path?: string; relevance?: string; description?: string }>;
  confidence?: number;
  suggested_fix?: string;
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`font-semibold ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ActionPlanPanel({
  task,
  t,
}: {
  task: AgentTask;
  t: ReturnType<typeof useTranslations<'agentTaskDetail'>>;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const diagEntry = (task.executionLog ?? []).find(e => e.step === 'update_diagnosis');
  if (!diagEntry) return null;

  const planData = diagEntry.toolInput as ActionPlanData | undefined;
  if (!planData) return null;

  const showButtons = task.status === 'plan_pending_review' || task.status === 'analyzing';

  async function handleApprove() {
    setIsSubmitting(true);
    try {
      await agentTasksApi.approveTask(task.id, 'plan');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await agentTasksApi.rejectTask(task.id, 'plan', rejectReason || undefined);
      setShowRejectInput(false);
      setRejectReason('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('actionPlan')}</h4>

      {/* Root Cause */}
      {planData.root_cause && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            {t('rootCause')}
          </p>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <MarkdownRenderer content={planData.root_cause} />
          </div>
        </div>
      )}

      {/* Confidence */}
      {planData.confidence !== undefined && (
        <ConfidenceBar value={planData.confidence} label={t('confidence')} />
      )}

      {/* Affected Files */}
      {planData.affected_files && planData.affected_files.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            {t('affectedFiles')}
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('filePath')}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('relevance')}
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('fileDescription')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {planData.affected_files.map((file, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-900">
                    <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400 break-all">
                      {file.file_path || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          file.relevance === 'primary'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {file.relevance || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {file.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suggested Fix */}
      {planData.suggested_fix && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            {t('suggestedFix')}
          </p>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
            <MarkdownRenderer content={planData.suggested_fix} />
          </div>
        </div>
      )}

      {/* Approve / Reject buttons */}
      {showButtons && (
        <div className="space-y-3">
          {showRejectInput && (
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('rejectPlaceholder')}
              className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
          )}
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('approvePlan')}
            </button>
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showRejectInput ? t('confirmReject') : t('reject')}
            </button>
            {showRejectInput && (
              <button
                onClick={() => {
                  setShowRejectInput(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Tab: Diagnosis ----
function DiagnosisTab({
  diagnosis,
  executionLog,
  task,
  t,
}: {
  diagnosis: DiagnosisSnapshot | null;
  executionLog: AgentTask['executionLog'];
  task: AgentTask;
  t: ReturnType<typeof useTranslations<'agentTaskDetail'>>;
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
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t('noDiagnosis')}</div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('sourceLabel')}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            {t('extractedFromLogs')}
          </span>
        </div>

        {/* Structured ActionPlan from update_diagnosis toolInput */}
        <ActionPlanPanel task={task} t={t} />

        {diagEntry && !diagEntry.toolInput && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('diagnosisToolCall')}
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
              {t('agentConclusion')}
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
              {t('lastAgentReasoning')}
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
      {/* Structured plan panel (always shown at top when diagEntry exists) */}
      <ActionPlanPanel task={task} t={t} />

      {/* Confidence */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('confidenceLabel')}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${confidenceColor}`}
        >
          {confidencePercent}%
        </span>
      </div>

      {/* Root Cause */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('rootCause')}
        </h4>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <MarkdownRenderer content={diagnosis.rootCause} />
        </div>
      </div>

      {/* Suggested Fix */}
      {diagnosis.suggestedFix && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('suggestedFix')}
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
            {t('affectedFilesCount', { count: diagnosis.affectedFiles.length })}
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

interface TimelineStepLabels {
  analysis: string;
  investigation: string;
  diagnosis: string;
  codegen: string;
  branch: string;
  pr: string;
  completed: string;
  expired: string;
  failed: string;
  analyzing: string;
  toolCalls: (count: number) => string;
  filesModified: (count: number) => string;
}

/**
 * Build a data-driven timeline from execution logs.
 * Instead of a fixed V1 pipeline, this detects which phases actually occurred.
 */
function buildDerivedTimeline(task: AgentTask, labels: TimelineStepLabels): DerivedTimelineStep[] {
  const logs = task.executionLog ?? [];
  const steps: DerivedTimelineStep[] = [];

  // 1) Analysis started
  const analysisStart = logs.find(e => e.step === 'analysis_started');
  if (analysisStart || task.startedAt) {
    steps.push({
      key: 'analysis',
      label: labels.analysis,
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
      label: labels.investigation,
      status: 'done',
      detail: labels.toolCalls(investigationCalls.length),
      timestamp: investigationCalls[0]?.timestamp as string,
    });
  }

  // 3) Diagnosis / Plan
  const diagnosisCalls = logs.filter(e => e.step === 'update_diagnosis');
  if (diagnosisCalls.length > 0) {
    const lastDiag = diagnosisCalls[diagnosisCalls.length - 1];
    steps.push({
      key: 'diagnosis',
      label: labels.diagnosis,
      status: 'done',
      timestamp: lastDiag?.timestamp as string,
      detail: (lastDiag?.resultPreview as string) || undefined,
    });
  } else if (task.diagnosisSnapshot) {
    steps.push({
      key: 'diagnosis',
      label: labels.diagnosis,
      status: 'done',
      detail: `confidence: ${Math.round(task.diagnosisSnapshot.confidence * 100)}%`,
    });
  }

  // 4) Code Generation — write_file / edit_file
  const codeGenCalls = logs.filter(e => ['write_file', 'edit_file'].includes(e.step));
  if (codeGenCalls.length > 0) {
    steps.push({
      key: 'codegen',
      label: labels.codegen,
      status: 'done',
      timestamp: codeGenCalls[0]?.timestamp as string,
      detail: labels.filesModified(codeGenCalls.length),
    });
  }

  // 5) Branch creation
  const branchCall = logs.find(e => e.step === 'create_branch');
  if (branchCall || task.branchName) {
    steps.push({
      key: 'branch',
      label: labels.branch,
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
      label: labels.pr,
      status: 'done',
      timestamp: prCall?.timestamp as string,
      detail: task.prUrl ? `PR #${task.prNumber}` : (prCall?.message as string) || undefined,
    });
  }

  // 7) Final status
  if (task.status === 'completed') {
    steps.push({
      key: 'completed',
      label: labels.completed,
      status: 'done',
      timestamp: task.completedAt || undefined,
    });
  } else if (task.status === 'failed' || task.status === 'expired') {
    steps.push({
      key: 'failed',
      label: task.status === 'expired' ? labels.expired : labels.failed,
      status: 'done',
    });
  } else {
    // Task is still in progress — add a "current" step
    const lastLog = logs[logs.length - 1];
    steps.push({
      key: 'in_progress',
      label: task.status === 'analyzing' ? labels.analyzing : task.status,
      status: 'current',
      timestamp: lastLog?.timestamp as string,
    });
  }

  return steps;
}

// ---- Tab: Timeline ----
function TimelineTab({
  task,
  t,
}: {
  task: AgentTask;
  t: ReturnType<typeof useTranslations<'agentTaskDetail'>>;
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const codegenFiles = getCodegenFiles(task.executionLog ?? []);

  const timelineLabels: TimelineStepLabels = {
    analysis: t('stepAnalysis'),
    investigation: t('stepInvestigation'),
    diagnosis: t('stepDiagnosis'),
    codegen: t('stepCodeGeneration'),
    branch: t('stepBranchCreated'),
    pr: t('stepPullRequest'),
    completed: t('stepCompleted'),
    expired: t('stepExpired'),
    failed: t('stepFailed'),
    analyzing: t('stepAnalyzing'),
    toolCalls: (count: number) => t('toolCalls', { count }),
    filesModified: (count: number) => t('filesModified', { count }),
  };

  const derivedSteps = buildDerivedTimeline(task, timelineLabels);

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
                {t('timelineStartedAt')}{' '}
                <span className="font-medium">{formatDate(task.startedAt)}</span>
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
              {t('timelineConfidence')}{' '}
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
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('diagnosisFromAnalysis')}</p>
        );

      case 'codegen':
        return codegenFiles.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('timelineModifiedFiles', { count: codegenFiles.length })}
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
            {t('timelineBranch')}{' '}
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
                {t('timelinePrLink', { number: task.prNumber ?? '' })}
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
              {t('timelineDuration')}{' '}
              <span className="font-medium">
                {formatDuration(task.startedAt, task.completedAt)}
              </span>
            </p>
            {task.diagnosisSnapshot && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('timelineDiagnosisConfidence')}{' '}
                {Math.round(task.diagnosisSnapshot.confidence * 100)}%
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
  const t = useTranslations('agentTaskDetail');
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: TabDef[] = [
    { id: 'overview', label: t('tabOverview') },
    { id: 'diagnosis', label: t('tabDiagnosis') },
    { id: 'logs', label: t('tabLogs') },
    { id: 'timeline', label: t('tabTimeline') },
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
        {activeTab === 'overview' && <OverviewTab task={task} isLive={isLive} t={t} />}
        {activeTab === 'diagnosis' && (
          <DiagnosisTab
            diagnosis={task.diagnosisSnapshot}
            executionLog={task.executionLog ?? []}
            task={task}
            t={t}
          />
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
        {activeTab === 'timeline' && <TimelineTab task={task} t={t} />}
      </div>
    </div>
  );
}

export { isInProgress, isTerminal };
