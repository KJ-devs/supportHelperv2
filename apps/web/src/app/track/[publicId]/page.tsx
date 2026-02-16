import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Clock,
  Search,
  CheckCircle2,
  Code2,
  GitPullRequest,
  GitMerge,
  Rocket,
  FileText,
  CircleDot,
  AlertTriangle,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// --- Types ---

interface TicketEvent {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface TrackingData {
  id: string;
  publicId: string;
  title: string | null;
  status: string;
  type: string | null;
  severity: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  ticketEvents: TicketEvent[];
}

// --- Helpers ---

const EVENT_LABELS: Record<string, string> = {
  ticket_received: 'Report received',
  analysis_started: 'Analysis in progress',
  agent_analysis_started: 'Analysis in progress',
  analysis_completed: 'Analysis complete',
  agent_plan_ready: 'Analysis complete',
  agent_plan_approved: 'Fix plan approved',
  code_generation_started: 'Fix in progress',
  code_generation_completed: 'Fix ready for review',
  pr_created: 'Fix ready for review',
  pr_merged: 'Fix deployed',
  fix_deployed: 'Issue resolved',
  resolution_sent: 'Resolution notification sent',
  ticket_reopened: 'Ticket reopened',
};

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'ticket_received':
      return FileText;
    case 'analysis_started':
    case 'agent_analysis_started':
      return Search;
    case 'analysis_completed':
    case 'agent_plan_ready':
      return CheckCircle2;
    case 'agent_plan_approved':
      return CheckCircle2;
    case 'code_generation_started':
      return Code2;
    case 'code_generation_completed':
    case 'pr_created':
      return GitPullRequest;
    case 'pr_merged':
      return GitMerge;
    case 'fix_deployed':
      return Rocket;
    case 'resolution_sent':
      return Mail;
    case 'ticket_reopened':
      return RotateCcw;
    default:
      return CircleDot;
  }
}

type StatusConfig = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
};

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case 'new':
    case 'open':
      return { label: status.charAt(0).toUpperCase() + status.slice(1), variant: 'default' };
    case 'in_progress':
    case 'analyzing':
      return {
        label: status === 'in_progress' ? 'In Progress' : 'Analyzing',
        variant: 'warning',
      };
    case 'merged':
    case 'resolved':
      return {
        label: status.charAt(0).toUpperCase() + status.slice(1),
        variant: 'success',
      };
    case 'closed':
      return { label: 'Closed', variant: 'secondary' };
    default:
      return { label: status, variant: 'outline' };
  }
}

function getSeverityConfig(severity: string | null): StatusConfig | null {
  if (!severity) return null;
  switch (severity) {
    case 'critical':
      return { label: 'Critical', variant: 'destructive' };
    case 'high':
      return { label: 'High', variant: 'warning' };
    case 'medium':
      return { label: 'Medium', variant: 'secondary' };
    case 'low':
      return { label: 'Low', variant: 'outline' };
    default:
      return { label: severity, variant: 'outline' };
  }
}

// --- Data Fetching ---

async function fetchTrackingData(publicId: string): Promise<TrackingData | null> {
  try {
    const res = await fetch(`${API_URL}/api/tickets/track/${encodeURIComponent(publicId)}`, {
      cache: 'no-store',
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch {
    return null;
  }
}

// --- Page ---

interface TrackPageProps {
  params: Promise<{ publicId: string }>;
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  const { publicId } = await params;

  return {
    title: `Tracking ${publicId}`,
    description: `Track the status of ticket ${publicId}`,
  };
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { publicId } = await params;

  if (!publicId || publicId.length > 20) {
    notFound();
  }

  const ticket = await fetchTrackingData(publicId);

  if (!ticket) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-semibold">Ticket not found</h2>
                <p className="mt-1 text-muted-foreground">
                  No ticket was found with tracking ID <code className="text-sm bg-muted px-1.5 py-0.5 rounded">{publicId}</code>. Please check the URL and try again.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(ticket.status);
  const severityConfig = getSeverityConfig(ticket.severity);
  const resolutionEvent = ticket.ticketEvents.find(
    (e) => e.eventType === 'resolution_sent',
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Tracking ID:</span>
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{ticket.publicId}</code>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {ticket.title || 'Bug Report'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          {severityConfig && (
            <Badge variant={severityConfig.variant}>{severityConfig.label} severity</Badge>
          )}
          {ticket.type && (
            <Badge variant="outline">{ticket.type.replace('_', ' ')}</Badge>
          )}
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Status Timeline</CardTitle>
          <p className="text-sm text-muted-foreground">
            Reported {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
            {ticket.updatedAt !== ticket.createdAt && (
              <> &middot; Updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}</>
            )}
          </p>
        </CardHeader>
        <CardContent>
          {ticket.ticketEvents.length > 0 ? (
            <div className="relative ml-3">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-6">
                {ticket.ticketEvents.map((event, index) => {
                  const Icon = getEventIcon(event.eventType);
                  const label = EVENT_LABELS[event.eventType] || event.eventType;
                  const isLatest = index === ticket.ticketEvents.length - 1;

                  return (
                    <div key={event.id} className="relative flex items-start gap-4">
                      <div
                        className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          isLatest
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p
                          className={`text-sm font-medium ${
                            isLatest ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Your report has been received. We are working on it.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolution Summary */}
      {ticket.resolvedAt || ticket.status === 'merged' ? (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div className="space-y-3">
                <div>
                  <p className="font-medium">This issue has been resolved</p>
                  {ticket.resolvedAt && (
                    <p className="text-sm text-muted-foreground">
                      Resolved {formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
                {resolutionEvent && (
                  <>
                    {resolutionEvent.data.summary && (
                      <p className="text-sm">{String(resolutionEvent.data.summary)}</p>
                    )}
                    {Array.isArray(resolutionEvent.data.changes) && resolutionEvent.data.changes.length > 0 && (
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        {(resolutionEvent.data.changes as string[]).map((change, i) => (
                          <li key={i}>{change}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Footer help section */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Still having issues? Please contact support with your tracking ID{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{ticket.publicId}</code> for
            further assistance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
