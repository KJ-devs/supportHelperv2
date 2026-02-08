'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  CheckCircle,
  Edit,
  ExternalLink,
  GitBranch,
  MoreHorizontal,
  Trash2,
  User,
  Copy,
  Share2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { TicketDetail, TicketStatus, TicketPriority } from '@/types/ticket';
import { useToast } from '@/hooks/use-toast';

interface TicketDetailHeaderProps {
  ticket: TicketDetail;
  onStatusChange?: (status: TicketStatus) => void;
  onDelete?: () => void;
  isUpdating?: boolean;
}

const statusVariants: Record<TicketStatus, { color: string; bgColor: string }> = {
  open: { color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_progress: { color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  resolved: { color: 'text-green-700', bgColor: 'bg-green-100' },
  closed: { color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const priorityVariants: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export function TicketDetailHeader({
  ticket,
  onStatusChange,
  onDelete,
  isUpdating,
}: TicketDetailHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const statusConfig = statusVariants[ticket.status];
  const priorityConfig = priorityVariants[ticket.priority];

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: 'Link copied',
      description: 'Ticket link copied to clipboard',
    });
  }, [toast]);

  const handleMarkResolved = useCallback(() => {
    onStatusChange?.('resolved');
  }, [onStatusChange]);

  const handleReopen = useCallback(() => {
    onStatusChange?.('open');
  }, [onStatusChange]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Ticket #{ticket.id.slice(0, 8)}</h1>
          </div>
          <p className="text-xl text-muted-foreground">{ticket.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'font-medium')}>
              {ticket.status.replace('_', ' ')}
            </Badge>
            <Badge className={cn(priorityConfig, 'font-medium')}>{ticket.priority} priority</Badge>
            <Badge variant="outline" className="capitalize">
              {ticket.category}
            </Badge>
            {ticket.githubIssue && (
              <a
                href={ticket.githubIssue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Badge variant="outline" className="gap-1 hover:bg-muted">
                  <GitBranch className="h-3 w-3" />#{ticket.githubIssue.number}
                  <ExternalLink className="h-3 w-3" />
                </Badge>
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ticket.status === 'resolved' || ticket.status === 'closed' ? (
            <Button variant="outline" onClick={handleReopen} disabled={isUpdating}>
              Reopen Ticket
            </Button>
          ) : (
            <Button onClick={handleMarkResolved} disabled={isUpdating}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Resolved
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push(`/tickets/${ticket.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Ticket
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Assign to me
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the ticket and all
              associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete?.();
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TicketDetailHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-96" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  );
}
