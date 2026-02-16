/**
 * Ticket Timeline Component
 * Displays a vertical timeline of ticket lifecycle events
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

// --- Types ---

interface TimelineEntry {
  id: string;
  eventType: string;
  data: Record<string, any>;
  createdAt: string;
  status: 'done' | 'in_progress' | 'failed';
}

// --- Event display config ---

const EVENT_CONFIG: Record<string, { label: string; color: string }> = {
  ticket_created: { label: 'Ticket Created', color: 'bg-green-500' },
  ticket_updated: { label: 'Ticket Updated', color: 'bg-blue-500' },
  github_issue_created: { label: 'GitHub Issue Created', color: 'bg-purple-500' },
  agent_analysis_started: { label: 'AI Analysis Started', color: 'bg-blue-400' },
  agent_analysis_completed: { label: 'Analysis Complete', color: 'bg-green-500' },
  agent_plan_ready: { label: 'Action Plan Ready', color: 'bg-green-500' },
  agent_plan_approved: { label: 'Plan Approved', color: 'bg-green-500' },
  agent_code_generation_started: { label: 'Code Generation Started', color: 'bg-blue-400' },
  agent_code_ready: { label: 'Code Generated', color: 'bg-green-500' },
  agent_pr_created: { label: 'Pull Request Created', color: 'bg-purple-500' },
  agent_pr_updated: { label: 'Pull Request Updated', color: 'bg-purple-400' },
  ci_check_passed: { label: 'CI Checks Passed', color: 'bg-green-500' },
  ci_check_failed: { label: 'CI Check Failed', color: 'bg-red-500' },
  agent_retry: { label: 'Agent Retrying', color: 'bg-yellow-500' },
  agent_failed: { label: 'Agent Failed', color: 'bg-red-500' },
  agent_escalated: { label: 'Escalated', color: 'bg-red-600' },
};

// --- Relative time helper ---

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

// --- Status dot component ---

function StatusDot({ status, color }: { status: TimelineEntry['status']; color: string }) {
  if (status === 'in_progress') {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
      </span>
    );
  }

  if (status === 'failed') {
    return <span className="inline-flex rounded-full h-3 w-3 bg-red-500" />;
  }

  return <span className={`inline-flex rounded-full h-3 w-3 ${color}`} />;
}

// --- Data links renderer ---

function EventDataLinks({ data }: { data: Record<string, any> }) {
  const links: JSX.Element[] = [];

  if (data.prUrl) {
    links.push(
      <a
        key="pr"
        href={data.prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
      >
        PR #{data.prNumber || 'link'}
      </a>
    );
  }

  if (data.agentTaskId) {
    links.push(
      <span key="task" className="text-xs text-gray-500">
        Task {data.agentTaskId.substring(0, 8)}
      </span>
    );
  }

  if (data.issueUrl) {
    links.push(
      <a
        key="issue"
        href={data.issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
      >
        Issue #{data.issueNumber || 'link'}
      </a>
    );
  }

  if (data.message) {
    links.push(
      <span key="msg" className="text-xs text-gray-500">
        {data.message}
      </span>
    );
  }

  if (links.length === 0) return null;

  return <div className="flex flex-wrap gap-2 mt-1">{links}</div>;
}

// --- Skeleton loader ---

function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-gray-200" />
            {i < 3 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main component ---

interface TicketTimelineProps {
  ticketId: string;
}

export function TicketTimeline({ ticketId }: TicketTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/v1/tickets/${ticketId}/timeline`, { headers });

      if (!res.ok) {
        throw new Error(`Failed to load timeline (${res.status})`);
      }

      const data: TimelineEntry[] = await res.json();
      setEntries(data);
    } catch (err: any) {
      setError(err.message || 'Error loading timeline');
      console.error('Timeline fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
        <button
          onClick={fetchTimeline}
          disabled={isLoading}
          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {isLoading && entries.length === 0 && <TimelineSkeleton />}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No events yet.</p>
      )}

      {entries.length > 0 && (
        <div className="space-y-0">
          {entries.map((entry, idx) => {
            const config = EVENT_CONFIG[entry.eventType] || {
              label: entry.eventType.replace(/_/g, ' '),
              color: 'bg-gray-400',
            };
            const isLast = idx === entries.length - 1;

            return (
              <div key={entry.id} className="flex gap-3">
                {/* Left rail: dot + line */}
                <div className="flex flex-col items-center">
                  <div className="mt-1">
                    <StatusDot status={entry.status} color={config.color} />
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 mt-1 min-h-[16px]" />
                  )}
                </div>

                {/* Right content */}
                <div className={`flex-1 ${isLast ? '' : 'pb-4'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{config.label}</span>
                    <span className="text-xs text-gray-400">{relativeTime(entry.createdAt)}</span>
                  </div>
                  <EventDataLinks data={entry.data || {}} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
