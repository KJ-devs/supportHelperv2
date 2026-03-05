'use client';

import { useEffect, useRef } from 'react';

export interface ActivityItem {
  id: string;
  timestamp: Date;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'activity' | 'complete';
  message: string;
  toolName?: string;
  agentLevel?: 'N1' | 'N2';
  durationMs?: number;
  hasError?: boolean;
}

interface LiveActivityFeedProps {
  activities: ActivityItem[];
  isActive: boolean;
  agentLevel: 'N1' | 'N2' | null;
  currentAction?: string | null;
}

const TYPE_STYLES: Record<ActivityItem['type'], { dot: string; text: string; icon: string }> = {
  thinking: { dot: 'bg-gray-500', text: 'text-gray-400', icon: '·' },
  tool_call: { dot: 'bg-blue-500', text: 'text-blue-400', icon: '→' },
  tool_result: { dot: 'bg-green-500', text: 'text-green-400', icon: '✓' },
  activity: { dot: 'bg-cyan-500', text: 'text-cyan-400', icon: '~' },
  complete: { dot: 'bg-emerald-500', text: 'text-emerald-400', icon: '✓' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatItemTime(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function LiveActivityFeed({ activities, isActive, currentAction }: LiveActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities, currentAction]);

  if (activities.length === 0 && !isActive) return null;

  return (
    <div className="mb-3 rounded-lg border border-gray-800 bg-gray-900/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
          Live Activity
        </span>
        {isActive && (
          <span className="flex items-center gap-1 text-[10px] text-cyan-500">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            Active
          </span>
        )}
      </div>

      <div className="max-h-[200px] overflow-y-auto px-3 py-2 space-y-1.5">
        {activities.map(item => {
          const styles = TYPE_STYLES[item.type];
          const isError = item.hasError;
          const dotClass = isError ? 'bg-red-500' : styles.dot;
          const textClass = isError ? 'text-red-400' : styles.text;

          return (
            <div key={item.id} className="flex items-start gap-2 animate-in fade-in duration-200">
              <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${dotClass}`} />
              <div className="flex-1 min-w-0">
                <span className={`text-xs ${textClass} break-words`}>{item.message}</span>
                {item.toolName && (
                  <span className="ml-1 text-[10px] text-gray-600 font-mono">
                    ({item.toolName})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.durationMs !== undefined && (
                  <span className="text-[10px] text-gray-600 font-mono bg-gray-800 px-1 rounded">
                    {formatDuration(item.durationMs)}
                  </span>
                )}
                <span className="text-[10px] text-gray-700 font-mono">
                  {formatItemTime(item.timestamp)}
                </span>
              </div>
            </div>
          );
        })}

        {isActive && currentAction && (
          <div className="flex items-center gap-2 text-xs text-gray-500 italic">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse flex-shrink-0" />
            <span>{currentAction}</span>
            <span className="inline-flex gap-0.5 ml-0.5">
              <span
                className="animate-bounce w-1 h-1 bg-gray-600 rounded-full"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="animate-bounce w-1 h-1 bg-gray-600 rounded-full"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="animate-bounce w-1 h-1 bg-gray-600 rounded-full"
                style={{ animationDelay: '300ms' }}
              />
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
