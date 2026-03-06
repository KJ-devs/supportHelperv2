'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgentTaskSocket } from '@/hooks/useAgentTaskSocket';
import type { ExecutionLogEntry } from '@/lib/api/agent-tasks';

type LogLevel = 'info' | 'success' | 'error' | 'warning';

interface LogLine {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

interface AgentTaskLogsProps {
  taskId: string;
  isActive?: boolean;
  initialLogs?: ExecutionLogEntry[];
}

function stepToLevel(step: string): LogLevel {
  if (step === 'error') return 'error';
  if (step === 'completed' || step === 'pr_created' || step === 'code_approved') return 'success';
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function entryToLogLine(entry: ExecutionLogEntry, index: number): LogLine {
  return {
    id: `${entry.step}-${index}-${entry.timestamp}`,
    timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    level: stepToLevel(entry.step),
    message: `[${entry.step}] ${entry.message}`,
  };
}

export function AgentTaskLogs({ taskId, isActive = false, initialLogs = [] }: AgentTaskLogsProps) {
  const [logs, setLogs] = useState<LogLine[]>(() =>
    initialLogs.map((entry, idx) => entryToLogLine(entry, idx))
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(initialLogs.length);

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

  if (!isConnected && logs.length === 0) {
    return (
      <div
        data-testid="agent-task-logs-terminal"
        className="h-full bg-zinc-950 flex items-center justify-center"
      >
        <span className="text-yellow-500 font-mono text-xs">WebSocket not connected</span>
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
            Live
          </span>
        </div>
      )}

      {/* Log lines */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-zinc-500 font-mono text-xs">
              {isActive ? 'Waiting for agent...' : 'No execution logs.'}
            </span>
          </div>
        ) : (
          logs.map(line => (
            <div key={line.id} className="flex items-start gap-2 font-mono text-xs leading-5">
              <span className="text-zinc-500 whitespace-nowrap flex-shrink-0">
                [{formatTime(line.timestamp)}]
              </span>
              <span className={`font-semibold flex-shrink-0 ${levelColor(line.level)}`}>
                [{line.level.toUpperCase()}]
              </span>
              <span className="text-zinc-200 break-all">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
