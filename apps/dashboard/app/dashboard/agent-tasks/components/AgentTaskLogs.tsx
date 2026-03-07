'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useAgentTaskSocket } from '@/hooks/useAgentTaskSocket';
import type { ExecutionLogEntry } from '@/lib/api/agent-tasks';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

type LogLevel = 'info' | 'success' | 'error' | 'warning';
type LogPhase = 'all' | 'analysis' | 'plan' | 'codegen' | 'pushpr' | 'system';

type StepCategory =
  | 'investigation'
  | 'search'
  | 'mutation'
  | 'completion'
  | 'diagnosis'
  | 'error'
  | 'system'
  | 'lifecycle'
  | 'reasoning';

interface LogLine {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  step: string;
  durationMs?: number;
  hasError?: boolean;
  isIteration: boolean;
  iterationNumber?: number;
  category: StepCategory;
  phase: LogPhase;
  metadata: Record<string, unknown>;
  detail?: string;
  toolInput?: Record<string, unknown>;
  resultPreview?: string;
  emoji?: string;
  // Rich detail fields from backend
  agentLevel?: string;
  modelUsed?: string;
  filePreview?: string;
  searchResults?: Array<{ filePath: string; fragment?: string }>;
  directoryContents?: string[];
  historyPreview?: unknown;
  codeChanges?: {
    filePath: string;
    operation: 'write' | 'edit';
    fullContent?: string;
    oldText?: string;
    newText?: string;
  };
  prData?: { number: number; url: string; title: string; reused?: boolean };
  fromLevel?: string;
  toLevel?: string;
  fromModel?: string;
  toModel?: string;
}

interface AgentTaskLogsProps {
  taskId: string;
  isActive?: boolean;
  initialLogs?: ExecutionLogEntry[];
}

const INVESTIGATION_STEPS = new Set(['read_file', 'list_directory', 'get_repo_structure']);
const SEARCH_STEPS = new Set(['search_code', 'search_codebase_semantic']);
const MUTATION_STEPS = new Set(['write_file', 'edit_file', 'create_branch']);
const COMPLETION_STEPS = new Set(['create_pull_request']);
const DIAGNOSIS_STEPS = new Set(['update_diagnosis']);
const LIFECYCLE_STEPS = new Set(['analysis_started', 'analysis_completed']);
const REASONING_STEPS = new Set(['thinking', 'conclusion']);

function stepToPhase(step: string): LogPhase {
  // Analysis phase — reading, searching, exploring
  if (
    [
      'analysis_started',
      'analysis_completed',
      'thinking',
      'read_file',
      'list_directory',
      'get_repo_structure',
      'get_file_history',
      'get_file_blame',
      'get_ticket_details',
      'search_similar_tickets',
    ].includes(step)
  )
    return 'analysis';
  if (step.startsWith('search_')) return 'analysis';

  // Plan / Diagnosis phase — update_diagnosis is the agent's plan/diagnosis output
  if (step === 'update_diagnosis' || step === 'conclusion') return 'plan';
  if (step.startsWith('plan_')) return 'plan';

  // Code generation phase — writing/editing files, creating branches
  if (['write_file', 'edit_file', 'create_branch'].includes(step)) return 'codegen';
  if (
    step.startsWith('codegen_') &&
    !['codegen_pushing', 'codegen_branch_created', 'codegen_file_committed'].includes(step)
  )
    return 'codegen';

  // Push/PR phase — creating PRs, pushing code
  if (step === 'create_pull_request') return 'pushpr';
  if (['codegen_pushing', 'codegen_branch_created', 'codegen_file_committed'].includes(step))
    return 'pushpr';
  if (step.startsWith('pr_')) return 'pushpr';

  // Everything else → system
  return 'system';
}

function stepToCategory(step: string, hasError?: boolean): StepCategory {
  if (hasError || step === 'error') return 'error';
  if (INVESTIGATION_STEPS.has(step)) return 'investigation';
  if (SEARCH_STEPS.has(step)) return 'search';
  if (MUTATION_STEPS.has(step)) return 'mutation';
  if (COMPLETION_STEPS.has(step)) return 'completion';
  if (DIAGNOSIS_STEPS.has(step)) return 'diagnosis';
  if (LIFECYCLE_STEPS.has(step)) return 'lifecycle';
  if (REASONING_STEPS.has(step)) return 'reasoning';
  if (step === 'model_upgrade') return 'system';
  if (/^iteration_\d+$/.test(step)) return 'system';
  return 'system';
}

function stepToLevel(step?: string, hasError?: boolean): LogLevel {
  if (!step) return 'info';
  if (hasError || step === 'error') return 'error';
  if (
    step === 'completed' ||
    step === 'pr_created' ||
    step === 'code_approved' ||
    step === 'analysis_completed' ||
    step === 'create_pull_request' ||
    step === 'create_branch'
  )
    return 'success';
  if (step.includes('warn') || step === 'plan_pending_review' || step === 'code_pending_review')
    return 'warning';
  return 'info';
}

function levelColor(level: LogLevel): string {
  switch (level) {
    case 'success':
      return 'text-emerald-400';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    default:
      return 'text-green-400';
  }
}

function categoryColor(category: StepCategory): string {
  switch (category) {
    case 'investigation':
      return 'text-blue-400 bg-blue-950/40 border-blue-800/40';
    case 'search':
      return 'text-purple-400 bg-purple-950/40 border-purple-800/40';
    case 'mutation':
      return 'text-orange-400 bg-orange-950/40 border-orange-800/40';
    case 'completion':
      return 'text-green-400 bg-green-950/40 border-green-800/40';
    case 'diagnosis':
      return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
    case 'error':
      return 'text-red-400 bg-red-950/40 border-red-800/40';
    case 'lifecycle':
      return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40';
    case 'reasoning':
      return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
    case 'system':
    default:
      return 'text-zinc-400 bg-zinc-900/40 border-zinc-700/40';
  }
}

function categoryDotColor(category: StepCategory): string {
  switch (category) {
    case 'investigation':
      return 'bg-blue-400';
    case 'search':
      return 'bg-purple-400';
    case 'mutation':
      return 'bg-orange-400';
    case 'completion':
      return 'bg-green-400';
    case 'diagnosis':
      return 'bg-emerald-400';
    case 'error':
      return 'bg-red-400';
    case 'lifecycle':
      return 'bg-cyan-400';
    case 'reasoning':
      return 'bg-amber-400';
    case 'system':
    default:
      return 'bg-zinc-500';
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

const VALID_PHASES = new Set<string>(['analysis', 'plan', 'codegen', 'pushpr', 'system']);

function entryToLogLine(entry: ExecutionLogEntry, index: number): LogLine {
  const {
    step,
    message,
    timestamp,
    durationMs,
    hasError,
    detail,
    toolInput,
    resultPreview,
    emoji,
    phase: backendPhase,
    agentLevel,
    modelUsed,
    filePreview,
    searchResults,
    directoryContents,
    historyPreview,
    codeChanges,
    prData,
    fromLevel,
    toLevel,
    fromModel,
    toModel,
    ...rest
  } = entry;
  const iterMatch = step?.match(/^iteration_(\d+)$/);
  const isIteration = Boolean(iterMatch);
  const iterationNumber = iterMatch?.[1] !== undefined ? parseInt(iterMatch[1], 10) : undefined;
  const category = stepToCategory(step ?? '', hasError as boolean | undefined);
  const phase =
    typeof backendPhase === 'string' && VALID_PHASES.has(backendPhase)
      ? (backendPhase as LogPhase)
      : stepToPhase(step ?? '');

  // Collect extra metadata (exclude core fields and new rich fields)
  const metadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    metadata[k] = v;
  }

  return {
    id: `${step}-${index}-${timestamp}`,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    level: stepToLevel(step, hasError as boolean | undefined),
    message,
    step: step ?? '',
    durationMs: typeof durationMs === 'number' ? durationMs : undefined,
    hasError: Boolean(hasError),
    isIteration,
    iterationNumber,
    category,
    phase,
    metadata,
    detail: typeof detail === 'string' ? detail : undefined,
    toolInput:
      toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)
        ? (toolInput as Record<string, unknown>)
        : undefined,
    resultPreview: typeof resultPreview === 'string' ? resultPreview : undefined,
    emoji: typeof emoji === 'string' ? emoji : undefined,
    agentLevel: typeof agentLevel === 'string' ? agentLevel : undefined,
    modelUsed: typeof modelUsed === 'string' ? modelUsed : undefined,
    filePreview: typeof filePreview === 'string' ? filePreview : undefined,
    searchResults: Array.isArray(searchResults)
      ? (searchResults as Array<{ filePath: string; fragment?: string }>)
      : undefined,
    directoryContents: Array.isArray(directoryContents)
      ? (directoryContents as string[])
      : undefined,
    historyPreview,
    codeChanges:
      codeChanges && typeof codeChanges === 'object' && !Array.isArray(codeChanges)
        ? (codeChanges as LogLine['codeChanges'])
        : undefined,
    prData:
      prData && typeof prData === 'object' && !Array.isArray(prData)
        ? (prData as LogLine['prData'])
        : undefined,
    fromLevel: typeof fromLevel === 'string' ? fromLevel : undefined,
    toLevel: typeof toLevel === 'string' ? toLevel : undefined,
    fromModel: typeof fromModel === 'string' ? fromModel : undefined,
    toModel: typeof toModel === 'string' ? toModel : undefined,
  };
}

function ModelUpgradeSeparator({ line }: { line: LogLine }) {
  const from = line.fromLevel || 'N1';
  const to = line.toLevel || 'N2';
  return (
    <div className="flex items-center gap-2 py-1.5 my-0.5 rounded-lg bg-gradient-to-r from-blue-950/60 to-purple-950/60 border border-purple-700/40 px-3">
      <div className="flex-1 border-t border-zinc-700" />
      <span className="text-[10px] font-mono uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
        <span className="text-blue-400">{from}</span>
        <span className="text-zinc-500">→</span>
        <span className="text-purple-400">{to}</span>
        <span className="text-amber-500 ml-1">{line.message}</span>
      </span>
      <div className="flex-1 border-t border-zinc-700" />
    </div>
  );
}

function IterationSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 my-0.5">
      <div className="flex-1 border-t border-zinc-800" />
      <span className="text-zinc-600 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 border-t border-zinc-800" />
    </div>
  );
}

function FilePreviewPanel({ filePreview }: { filePreview: string }) {
  return (
    <pre className="mt-2 p-3 bg-gray-950 rounded-lg text-xs font-mono text-gray-300 max-h-64 overflow-auto border border-gray-800">
      {filePreview.split('\n').map((fileLine, i) => (
        <div key={i} className="flex">
          <span className="text-gray-600 select-none w-8 text-right mr-3 flex-shrink-0">
            {i + 1}
          </span>
          <span className="flex-1 whitespace-pre-wrap break-all">{fileLine}</span>
        </div>
      ))}
    </pre>
  );
}

function SearchResultsPanel({
  searchResults,
}: {
  searchResults: Array<{ filePath: string; fragment?: string }>;
}) {
  return (
    <div className="mt-2 space-y-1">
      {searchResults.map((hit, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className="text-blue-400 font-mono flex-shrink-0">{hit.filePath}</span>
          {hit.fragment && <span className="text-gray-400 truncate">{hit.fragment}</span>}
        </div>
      ))}
    </div>
  );
}

function DirectoryContentsPanel({ items }: { items: string[] }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1 text-xs font-mono">
      {items.map((item, i) => {
        const isDir = item.endsWith('/') || !item.includes('.');
        return (
          <div key={i} className="flex items-center gap-1.5 text-gray-300">
            <span className="text-gray-500">{isDir ? '📁' : '📄'}</span>
            <span className="truncate">{item}</span>
          </div>
        );
      })}
    </div>
  );
}

function CodeChangesPanel({ codeChanges }: { codeChanges: NonNullable<LogLine['codeChanges']> }) {
  if (codeChanges.operation === 'write' && codeChanges.fullContent) {
    return (
      <div className="mt-2">
        <div className="text-[10px] text-gray-500 font-mono mb-1">{codeChanges.filePath}</div>
        <pre className="p-3 bg-gray-950 rounded-lg text-xs font-mono text-gray-300 max-h-96 overflow-auto border border-gray-800 whitespace-pre-wrap break-all">
          {codeChanges.fullContent}
        </pre>
      </div>
    );
  }
  if (codeChanges.operation === 'edit' && (codeChanges.oldText || codeChanges.newText)) {
    return (
      <div className="mt-2 rounded-lg overflow-hidden border border-gray-800 text-xs font-mono">
        <div className="px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px]">
          {codeChanges.filePath}
        </div>
        {codeChanges.oldText &&
          codeChanges.oldText.split('\n').map((oldLine, i) => (
            <div key={`old-${i}`} className="flex bg-red-900/30 px-2 py-px">
              <span className="text-red-500 select-none w-4 mr-2 flex-shrink-0">-</span>
              <span className="text-red-300 whitespace-pre-wrap break-all flex-1">{oldLine}</span>
            </div>
          ))}
        {codeChanges.newText &&
          codeChanges.newText.split('\n').map((newLine, i) => (
            <div key={`new-${i}`} className="flex bg-green-900/30 px-2 py-px">
              <span className="text-green-500 select-none w-4 mr-2 flex-shrink-0">+</span>
              <span className="text-green-300 whitespace-pre-wrap break-all flex-1">{newLine}</span>
            </div>
          ))}
      </div>
    );
  }
  return null;
}

function PrDataPanel({
  prData,
  updatedLabel,
  newLabel,
  viewOnGitHubLabel,
}: {
  prData: NonNullable<LogLine['prData']>;
  updatedLabel: string;
  newLabel: string;
  viewOnGitHubLabel: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 p-3 bg-green-950/40 border border-green-800/40 rounded-lg">
      <span className="text-green-400 font-bold">PR #{prData.number}</span>
      <span className="text-gray-300">{prData.title}</span>
      {prData.reused ? (
        <span className="px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded-full">
          {updatedLabel}
        </span>
      ) : (
        <span className="px-2 py-0.5 text-xs bg-green-900/50 text-green-300 rounded-full">
          {newLabel}
        </span>
      )}
      <a
        href={prData.url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-auto text-blue-400 hover:underline text-xs"
      >
        {viewOnGitHubLabel}
      </a>
    </div>
  );
}

function hasRichDetail(line: LogLine): boolean {
  return Boolean(
    line.filePreview ||
    (line.searchResults && line.searchResults.length > 0) ||
    (line.directoryContents && line.directoryContents.length > 0) ||
    line.historyPreview ||
    line.codeChanges ||
    line.prData ||
    line.detail ||
    line.toolInput
  );
}

function LogRow({
  line,
  prUpdatedLabel,
  prNewLabel,
  viewOnGitHubLabel,
}: {
  line: LogLine;
  prUpdatedLabel: string;
  prNewLabel: string;
  viewOnGitHubLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails = hasRichDetail(line) || line.durationMs !== undefined || line.hasError;

  const colorClasses = categoryColor(line.category);
  const dotColor = categoryDotColor(line.category);
  // Extract just the text color for message display
  const textColorClass = colorClasses.split(' ')[0];

  const isReasoning = line.category === 'reasoning';
  const isPr = line.step === 'create_pull_request' && !line.hasError;

  return (
    <div className={`rounded overflow-hidden ${isPr ? 'border border-green-800/40' : ''}`}>
      {/* Main row */}
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(prev => !prev)}
        className={`w-full flex items-start gap-2 font-mono text-xs leading-5 px-1 py-0.5 rounded text-left transition-colors ${
          isPr ? 'bg-green-950/20 hover:bg-green-950/40' : ''
        } ${hasDetails ? 'cursor-pointer hover:bg-zinc-900' : 'cursor-default'}`}
      >
        {/* Timestamp */}
        <span className="text-zinc-500 whitespace-nowrap flex-shrink-0 pt-px">
          [{formatTime(line.timestamp)}]
        </span>

        {/* Category dot or emoji */}
        {line.emoji ? (
          <span className="flex-shrink-0 text-sm leading-5">{line.emoji}</span>
        ) : (
          <span className={`mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full ${dotColor}`} />
        )}

        {/* Level badge */}
        <span className={`font-semibold flex-shrink-0 ${levelColor(line.level)}`}>
          [{line.level.toUpperCase()}]
        </span>

        {/* Agent level badge */}
        {line.agentLevel && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 self-center ${
              line.agentLevel === 'N2'
                ? 'bg-purple-900/40 text-purple-400'
                : 'bg-blue-900/40 text-blue-400'
            }`}
          >
            {line.agentLevel}
          </span>
        )}

        {/* Message */}
        <span
          className={`break-all flex-1 ${isReasoning ? 'italic text-zinc-400' : 'text-zinc-200'}`}
        >
          <span className={`${textColorClass} font-semibold not-italic`}>[{line.step}]</span>{' '}
          {line.message}
        </span>

        {/* Duration badge */}
        {line.durationMs !== undefined && (
          <span className="flex-shrink-0 bg-zinc-800 text-zinc-400 rounded px-1 py-0.5 text-[10px] font-mono self-center">
            {formatDuration(line.durationMs)}
          </span>
        )}

        {/* Result preview badge */}
        {line.resultPreview && (
          <span className="flex-shrink-0 bg-zinc-800 text-zinc-400 rounded px-1 py-0.5 text-[10px] font-mono self-center max-w-[120px] truncate">
            {line.resultPreview}
          </span>
        )}

        {/* Error indicator */}
        {line.hasError && (
          <span className="flex-shrink-0 bg-red-950 text-red-400 rounded px-1 py-0.5 text-[10px] font-mono self-center">
            ERR
          </span>
        )}

        {/* PR inline link when not expanded */}
        {isPr && line.prData && !expanded && (
          <a
            href={line.prData.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0 text-green-400 text-[10px] font-mono self-center hover:underline"
          >
            PR #{line.prData.number}
          </a>
        )}

        {/* Expand chevron */}
        {hasDetails && (
          <span className="flex-shrink-0 text-zinc-600 self-center text-[10px] ml-1">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {/* Expanded detail panel */}
      <div
        className={`overflow-hidden transition-all duration-200 ${expanded && hasDetails ? 'max-h-[600px]' : 'max-h-0'}`}
      >
        {expanded && hasDetails && (
          <div
            className={`ml-10 mr-1 mb-1 p-2 rounded border text-[11px] font-mono space-y-1 ${colorClasses}`}
          >
            {/* Rich detail panels */}
            {line.filePreview && <FilePreviewPanel filePreview={line.filePreview} />}
            {line.searchResults && line.searchResults.length > 0 && (
              <SearchResultsPanel searchResults={line.searchResults} />
            )}
            {line.directoryContents && line.directoryContents.length > 0 && (
              <DirectoryContentsPanel items={line.directoryContents} />
            )}
            {line.codeChanges && <CodeChangesPanel codeChanges={line.codeChanges} />}
            {line.prData && (
              <PrDataPanel
                prData={line.prData}
                updatedLabel={prUpdatedLabel}
                newLabel={prNewLabel}
                viewOnGitHubLabel={viewOnGitHubLabel}
              />
            )}

            {/* Existing detail fields */}
            {!line.filePreview &&
              !line.searchResults &&
              !line.directoryContents &&
              !line.codeChanges &&
              !line.prData && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">step:</span>
                    <span>{line.step}</span>
                  </div>
                  {line.durationMs !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">duration:</span>
                      <span>{formatDuration(line.durationMs)}</span>
                      <span className="text-zinc-600">({line.durationMs}ms)</span>
                    </div>
                  )}
                  {line.hasError && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">status:</span>
                      <span className="text-red-400 font-semibold">ERROR</span>
                    </div>
                  )}
                  {line.toolInput && Object.keys(line.toolInput).length > 0 && (
                    <div>
                      <span className="text-zinc-500">input:</span>
                      <div className="mt-1 ml-2 space-y-0.5">
                        {Object.entries(line.toolInput).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-zinc-500">{k}:</span>
                            <span className="break-all text-zinc-300">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {line.detail && (
                    <div>
                      <span className="text-zinc-500">detail:</span>
                      <div className="bg-zinc-900/60 rounded p-2 mt-1 text-[11px] max-h-40 overflow-y-auto">
                        <MarkdownRenderer
                          content={line.detail}
                          className="text-zinc-300 [&_pre]:bg-zinc-950 [&_code]:bg-zinc-800 [&_p]:text-zinc-300 [&_p]:text-[11px] [&_strong]:text-zinc-200 [&_li]:text-zinc-300 [&_h1]:text-zinc-200 [&_h2]:text-zinc-200 [&_h3]:text-zinc-200"
                        />
                      </div>
                    </div>
                  )}
                  {Object.keys(line.metadata).length > 0 && (
                    <div>
                      <span className="text-zinc-500">metadata:</span>
                      <div className="mt-1 ml-2 space-y-0.5">
                        {Object.entries(line.metadata).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-zinc-500">{k}:</span>
                            <span className="break-all text-zinc-300">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

            {/* Show step/duration even when rich panels present */}
            {(line.filePreview ||
              line.searchResults ||
              line.directoryContents ||
              line.codeChanges ||
              line.prData) && (
              <>
                {line.durationMs !== undefined && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-zinc-500">duration:</span>
                    <span>{formatDuration(line.durationMs)}</span>
                  </div>
                )}
                {line.hasError && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-zinc-500">status:</span>
                    <span className="text-red-400 font-semibold">ERROR</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentTaskLogs({ taskId, isActive = false, initialLogs = [] }: AgentTaskLogsProps) {
  const t = useTranslations('agentTaskLogs');
  const [logs, setLogs] = useState<LogLine[]>(() =>
    initialLogs.map((entry, idx) => entryToLogLine(entry, idx))
  );
  const [activePhase, setActivePhase] = useState<LogPhase>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(initialLogs.length);

  // Phase labels — defined inside component so t() is available
  const PHASE_LABELS: Record<LogPhase, string> = {
    all: t('phaseAll'),
    analysis: t('phaseAnalysis'),
    plan: t('phasePlan'),
    codegen: t('phaseCodegen'),
    pushpr: t('phasePushPr'),
    system: t('phaseSystem'),
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  const handleLogAppended = useCallback((entry: ExecutionLogEntry) => {
    const idx = counterRef.current++;
    setLogs(prev => [...prev, entryToLogLine(entry, idx)]);
  }, []);

  const { isConnected } = useAgentTaskSocket(taskId, {
    onLogAppended: handleLogAppended,
  });

  // Compute counts per phase from the full log list
  const phaseCounts = logs.reduce<Record<LogPhase, number>>(
    (acc, line) => {
      acc.all += 1;
      acc[line.phase] += 1;
      return acc;
    },
    { all: 0, analysis: 0, plan: 0, codegen: 0, pushpr: 0, system: 0 }
  );

  const filteredLogs =
    activePhase === 'all' ? logs : logs.filter(line => line.phase === activePhase);

  if (!isConnected && logs.length === 0) {
    return (
      <div
        data-testid="agent-task-logs-terminal"
        className="h-full bg-zinc-950 flex items-center justify-center"
      >
        <span className="text-yellow-500 font-mono text-xs">{t('wsNotConnected')}</span>
      </div>
    );
  }

  return (
    <div data-testid="agent-task-logs-terminal" className="h-full bg-zinc-950 flex flex-col">
      {/* Header bar */}
      {isActive && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] text-green-400 font-mono uppercase tracking-wider">
            {t('live')}
          </span>
        </div>
      )}

      {/* Phase filter pills */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-zinc-800 flex-shrink-0 overflow-x-auto">
        {(Object.keys(PHASE_LABELS) as LogPhase[]).map(phase => {
          const isPhaseActive = phase === activePhase;
          return (
            <button
              key={phase}
              type="button"
              onClick={() => setActivePhase(phase)}
              className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
                isPhaseActive
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {PHASE_LABELS[phase]}
              <span className={`ml-1 ${isPhaseActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {phaseCounts[phase]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Log lines */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-zinc-500 font-mono text-xs">
              {logs.length === 0
                ? isActive
                  ? t('waitingForAgent')
                  : t('noExecutionLogs')
                : t('noLogsForPhase')}
            </span>
          </div>
        ) : (
          filteredLogs.map(line => {
            if (line.step === 'model_upgrade') {
              return <ModelUpgradeSeparator key={line.id} line={line} />;
            }
            if (line.isIteration) {
              return (
                <IterationSeparator
                  key={line.id}
                  label={t('iteration', { number: line.iterationNumber ?? 0 })}
                />
              );
            }
            return (
              <LogRow
                key={line.id}
                line={line}
                prUpdatedLabel={t('prUpdated')}
                prNewLabel={t('prNew')}
                viewOnGitHubLabel={t('viewOnGitHub')}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
