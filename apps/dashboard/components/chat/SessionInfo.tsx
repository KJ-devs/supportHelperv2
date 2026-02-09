'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';

interface SessionInfoProps {
  ticket: {
    id: string;
    title: string;
    description: string;
    status: string;
    severity: string;
    type: string;
  };
  sessionCreatedAt?: string;
  messageCount: number;
}

const severityVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
};

export function SessionInfo({ ticket, sessionCreatedAt, messageCount }: SessionInfoProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Ticket Context</h3>

      <div className="space-y-3">
        {/* Title */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Title</p>
          <Link
            href={`/dashboard/tickets/${ticket.id}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium line-clamp-2"
          >
            {ticket.title}
          </Link>
        </div>

        {/* Description preview */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Description</p>
          <p className="text-sm text-gray-700 line-clamp-3">{ticket.description}</p>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={severityVariant[ticket.severity] || 'default'}>
            {ticket.severity}
          </Badge>
          <Badge>{ticket.type}</Badge>
          <Badge variant="info">{ticket.status}</Badge>
        </div>

        {/* Session stats */}
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          {sessionCreatedAt && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Session started</span>
              <span className="text-gray-700">{formatDate(sessionCreatedAt)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Messages</span>
            <span className="text-gray-700">{messageCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
