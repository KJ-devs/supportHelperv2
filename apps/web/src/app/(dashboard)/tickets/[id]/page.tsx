import { type Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { TicketDetailClient } from '@/components/tickets/ticket-detail-client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

// Server-side metadata generation
export async function generateMetadata({ params }: TicketDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  // In production, fetch ticket title from API
  // const ticket = await fetchTicket(id);

  return {
    title: `Ticket #${id.slice(0, 8)} | Support Helper`,
    description: `View and manage details for ticket #${id}`,
    openGraph: {
      title: `Ticket #${id.slice(0, 8)}`,
      description: 'Support ticket details',
    },
  };
}

// Loading component for Suspense
function TicketDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
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

      {/* Content Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-full mt-4" />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 flex-1" />
              ))}
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Ticket Detail Page
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │ Header: Title, Status, Actions      │
 * ├──────────────────┬──────────────────┤
 * │                  │                  │
 * │  Video Player    │  Right Sidebar:  │
 * │  (Video.js 8.21) │  - Metadata      │
 * │                  │  - AI Summary    │
 * │  Timeline:       │  - Severity      │
 * │  [Events sync]   │  - Type          │
 * │                  │  - Assigned      │
 * │                  │  - GitHub issue  │
 * │                  │  - Similar (3)   │
 * ├──────────────────┴──────────────────┤
 * │ Tabs:                               │
 * │ - Description                       │
 * │ - Reproduction Steps                │
 * │ - Logs / Events                     │
 * │ - AI Analysis                       │
 * │ - Activity History                  │
 * │ - Agent Conversation                │
 * └─────────────────────────────────────┘
 *
 * Features:
 * - Video.js player with timeline event markers
 * - Click event → jump to timestamp
 * - OCR text overlay toggle
 * - Playback speed control
 * - Download video
 * - TanStack Query with optimistic updates
 * - Server Component for initial data, Client for interactions
 */
export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  // Validate ID format (basic check)
  if (id.length < 1 || id.length > 50) {
    notFound();
  }

  return (
    <Suspense fallback={<TicketDetailLoading />}>
      <TicketDetailClient ticketId={id} />
    </Suspense>
  );
}
