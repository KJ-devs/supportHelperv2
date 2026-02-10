'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  useTicketDetail,
  useUsers,
  useUpdateTicketStatus,
  useUpdateTicketPriority,
  useAssignTicket,
  useCreateGitHubIssue,
} from '@/hooks/use-ticket-detail';
import { useDeleteTicket } from '@/hooks/use-tickets';
import { useToast } from '@/hooks/use-toast';
import {
  TicketDetailHeader,
  TicketDetailHeaderSkeleton,
} from '@/components/tickets/ticket-detail-header';
import { VideoPlayer } from '@/components/tickets/video-player';
import { TicketSidebar, TicketSidebarSkeleton } from '@/components/tickets/ticket-sidebar';
import { TicketTabs, TicketTabsSkeleton } from '@/components/tickets/ticket-tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Video } from 'lucide-react';
import type { TicketStatus, TicketPriority, VideoEvent } from '@/types/ticket';

interface TicketDetailClientProps {
  ticketId: string;
}

export function TicketDetailClient({ ticketId }: TicketDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const videoPlayerRef = useRef<{ seekTo: (time: number) => void }>(null);

  // Queries
  const { data: ticket, isLoading, error } = useTicketDetail(ticketId);
  const { data: users = [] } = useUsers();

  // Mutations
  const updateStatus = useUpdateTicketStatus();
  const updatePriority = useUpdateTicketPriority();
  const assignTicket = useAssignTicket();
  const createGitHubIssue = useCreateGitHubIssue();
  const deleteTicket = useDeleteTicket();

  const isUpdating =
    updateStatus.isPending ||
    updatePriority.isPending ||
    assignTicket.isPending ||
    createGitHubIssue.isPending;

  // Handlers
  const handleStatusChange = useCallback(
    async (status: TicketStatus) => {
      try {
        await updateStatus.mutateAsync({ id: ticketId, status });
        toast({
          title: 'Status updated',
          description: `Ticket status changed to ${status.replace('_', ' ')}`,
        });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to update status',
        });
      }
    },
    [ticketId, updateStatus, toast]
  );

  const handlePriorityChange = useCallback(
    async (priority: TicketPriority) => {
      try {
        await updatePriority.mutateAsync({ id: ticketId, priority });
        toast({
          title: 'Priority updated',
          description: `Ticket priority changed to ${priority}`,
        });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to update priority',
        });
      }
    },
    [ticketId, updatePriority, toast]
  );

  const handleAssigneeChange = useCallback(
    async (assigneeId: string | null) => {
      try {
        await assignTicket.mutateAsync({ id: ticketId, assigneeId });
        toast({
          title: 'Assignee updated',
          description: assigneeId ? 'Ticket assigned successfully' : 'Ticket unassigned',
        });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to update assignee',
        });
      }
    },
    [ticketId, assignTicket, toast]
  );

  const handleCreateGitHubIssue = useCallback(async () => {
    try {
      // In a real app, you'd show a dialog to select repository
      await createGitHubIssue.mutateAsync({
        ticketId,
        repository: 'owner/repo', // Default or from config
        title: ticket?.title,
      });
      toast({
        title: 'GitHub issue created',
        description: 'Successfully linked GitHub issue to this ticket',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create GitHub issue',
      });
    }
  }, [ticketId, ticket?.title, createGitHubIssue, toast]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteTicket.mutateAsync(ticketId);
      toast({
        title: 'Ticket deleted',
        description: 'The ticket has been permanently deleted',
      });
      router.push('/tickets');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete ticket',
      });
    }
  }, [ticketId, deleteTicket, toast, router]);

  const handleEventClick = useCallback((_event: VideoEvent) => {
    // Event handling logic here
  }, []);

  const handleJumpToTimestamp = useCallback((timestamp: number) => {
    videoPlayerRef.current?.seekTo(timestamp);
  }, []);

  // Loading state
  if (isLoading) {
    return <TicketDetailLoading />;
  }

  // Error state
  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load ticket</h2>
        <p className="text-muted-foreground mb-4">
          {error?.message || 'The ticket could not be found'}
        </p>
        <button onClick={() => router.push('/tickets')} className="text-primary hover:underline">
          Return to tickets list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <TicketDetailHeader
        ticket={ticket}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        isUpdating={isUpdating}
      />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Video & Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Player */}
          {ticket.video ? (
            <VideoPlayer video={ticket.video} onEventClick={handleEventClick} />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No session recording available for this ticket</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <TicketTabs ticket={ticket} onJumpToTimestamp={handleJumpToTimestamp} />
        </div>

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-1">
          <TicketSidebar
            ticket={ticket}
            users={users}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onAssigneeChange={handleAssigneeChange}
            onCreateGitHubIssue={handleCreateGitHubIssue}
            isUpdating={isUpdating}
          />
        </div>
      </div>
    </div>
  );
}

function TicketDetailLoading() {
  return (
    <div className="space-y-6">
      <TicketDetailHeaderSkeleton />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Video Skeleton */}
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-full mt-4" />
            </CardContent>
          </Card>

          <TicketTabsSkeleton />
        </div>

        <div className="lg:col-span-1">
          <TicketSidebarSkeleton />
        </div>
      </div>
    </div>
  );
}
