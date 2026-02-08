'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Bot,
  Calendar,
  ExternalLink,
  GitBranch,
  Link2,
  Tag,
  User,
  Clock,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime, cn } from '@/lib/utils';
import type {
  TicketDetail,
  TicketStatus,
  TicketPriority,
  TicketSeverity,
  SimilarTicket,
  User as UserType,
} from '@/types/ticket';

interface TicketSidebarProps {
  ticket: TicketDetail;
  users?: UserType[];
  onStatusChange?: (status: TicketStatus) => void;
  onPriorityChange?: (priority: TicketPriority) => void;
  onAssigneeChange?: (assigneeId: string | null) => void;
  onCreateGitHubIssue?: () => void;
  isUpdating?: boolean;
}

const statusOptions: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
];

const priorityOptions: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-500' },
  { value: 'medium', label: 'Medium', color: 'text-blue-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
];

const severityOptions: { value: TicketSeverity; label: string; color: string }[] = [
  { value: 'minor', label: 'Minor', color: 'bg-gray-100 text-gray-700' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'major', label: 'Major', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' },
];

function UserDisplay({ user, label }: { user: UserType | null; label: string }) {
  if (!user) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <User className="h-4 w-4" />
          {label}
        </div>
        <p className="text-sm text-muted-foreground italic">Unassigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <User className="h-4 w-4" />
        {label}
      </div>
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar || undefined} />
          <AvatarFallback>
            {user.name
              .split(' ')
              .map(n => n[0])
              .join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
    </div>
  );
}

function SimilarTicketItem({ ticket }: { ticket: SimilarTicket }) {
  const statusColor = statusOptions.find(s => s.value === ticket.status)?.color || 'bg-gray-500';

  return (
    <a
      href={`/tickets/${ticket.id}`}
      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium line-clamp-2">{ticket.title}</p>
        <Badge variant="outline" className="shrink-0">
          {Math.round(ticket.similarity * 100)}%
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className={cn('w-2 h-2 rounded-full', statusColor)} />
        <span className="text-xs text-muted-foreground capitalize">
          {ticket.status.replace('_', ' ')}
        </span>
        {ticket.resolvedAt && (
          <>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              Resolved {formatRelativeTime(ticket.resolvedAt)}
            </span>
          </>
        )}
      </div>
    </a>
  );
}

export function TicketSidebar({
  ticket,
  users = [],
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onCreateGitHubIssue,
  isUpdating,
}: TicketSidebarProps) {
  const severityConfig = severityOptions.find(s => s.value === ticket.severity);

  return (
    <div className="space-y-4">
      {/* Metadata Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Status</label>
            <Select
              value={ticket.status}
              onValueChange={v => onStatusChange?.(v as TicketStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        statusOptions.find(s => s.value === ticket.status)?.color
                      )}
                    />
                    <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', status.color)} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Priority</label>
            <Select
              value={ticket.priority}
              onValueChange={v => onPriorityChange?.(v as TicketPriority)}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue>
                  <span
                    className={cn(
                      'capitalize',
                      priorityOptions.find(p => p.value === ticket.priority)?.color
                    )}
                  >
                    {ticket.priority}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map(priority => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <span className={priority.color}>{priority.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              Severity
            </div>
            <Badge className={severityConfig?.color}>{severityConfig?.label}</Badge>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Tag className="h-4 w-4" />
              Category
            </div>
            <Badge variant="outline" className="capitalize">
              {ticket.category}
            </Badge>
          </div>

          <Separator />

          {/* Assignee */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Assignee</label>
            <Select
              value={ticket.assignee?.id || 'unassigned'}
              onValueChange={v => onAssigneeChange?.(v === 'unassigned' ? null : v)}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee">
                  {ticket.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {ticket.assignee.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span>{ticket.assignee.name}</span>
                    </div>
                  ) : (
                    'Unassigned'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <UserDisplay user={ticket.customer} label="Customer" />

          <Separator />

          {/* Timestamps */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Created {formatDateTime(ticket.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Updated {formatRelativeTime(ticket.updatedAt)}</span>
            </div>
            {ticket.resolvedAt && (
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>Resolved {formatDateTime(ticket.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {ticket.tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Summary Card */}
      {ticket.aiAnalysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{ticket.aiAnalysis.summary}</p>
            {ticket.aiAnalysis.rootCause && (
              <div className="mt-3 p-2 bg-muted rounded-lg">
                <p className="text-xs font-medium text-muted-foreground">Likely Root Cause</p>
                <p className="text-sm mt-1">{ticket.aiAnalysis.rootCause}</p>
              </div>
            )}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>{Math.round(ticket.aiAnalysis.confidence * 100)}% confidence</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GitHub Issue Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            GitHub Issue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ticket.githubIssue ? (
            <a
              href={ticket.githubIssue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">#{ticket.githubIssue.number}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ticket.githubIssue.title}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={ticket.githubIssue.state === 'open' ? 'default' : 'secondary'}>
                  {ticket.githubIssue.state}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {ticket.githubIssue.repository}
                </span>
              </div>
            </a>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No linked GitHub issue</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onCreateGitHubIssue}
                disabled={isUpdating}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Create GitHub Issue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Similar Tickets Card */}
      {ticket.similarTickets.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Similar Tickets ({ticket.similarTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ticket.similarTickets.slice(0, 3).map(similar => (
              <SimilarTicketItem key={similar.id} ticket={similar} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Loading skeleton
export function TicketSidebarSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
