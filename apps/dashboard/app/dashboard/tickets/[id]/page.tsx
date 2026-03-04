/**
 * Ticket Detail Page
 * "Immersive Split" — white left pane + always-dark AI right pane (460px)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import { getTicketDiagnosis } from '@/lib/api/agent-v2';
import type { Ticket } from '@/lib/types/ticket';
import type { Diagnosis } from '@/components/diagnosis/DiagnosisPanelV3A';
import { DiagnosisPanelV3A } from '@/components/diagnosis/DiagnosisPanelV3A';
import { AgentSection } from '@/components/agent-chat/AgentSection';
import { PageLoader, StatusBadge, SeverityBadge, TypeBadge, Button, ConfirmModal, useToast } from '@/components/ui';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useTicketSocket, type AgentEscalatedToN2Event } from '@/hooks/useTicketSocket';

// --- Collapsible section header ---

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left group mb-3"
    >
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
      <span className="text-gray-400 text-xs select-none group-hover:text-gray-600 dark:group-hover:text-gray-300">
        {open ? '▴' : '▾'}
      </span>
    </button>
  );
}

// --- Main page ---

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth();
  const toast = useToast();

  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false);

  // Media pre-signed URLs
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});

  // Collapsible sections
  const [descOpen, setDescOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);
  const [recordingOpen, setRecordingOpen] = useState(true);

  // N1→N2 escalation notification (state only — hook is set up below after fetchDiagnosis)
  const [n2Notification, setN2Notification] = useState<AgentEscalatedToN2Event | null>(null);

  const fetchTicket = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ticketsApi.getTicket(ticketId);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
      console.error('Error fetching ticket:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  const fetchDiagnosis = useCallback(async () => {
    try {
      setIsDiagnosisLoading(true);
      const data = await getTicketDiagnosis(ticketId);
      setDiagnosis(data);
    } catch (err) {
      console.error('Error fetching diagnosis:', err);
    } finally {
      setIsDiagnosisLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading && ticketId) {
      fetchTicket();
      fetchDiagnosis();
    }
  }, [ticketId, authLoading, fetchTicket, fetchDiagnosis]);

  const handleAgentEscalatedToN2 = useCallback((event: AgentEscalatedToN2Event) => {
    if (event.ticketId === ticketId) {
      setN2Notification(event);
      // Refresh diagnosis after N1 completes so the panel shows new data
      fetchDiagnosis();
    }
  }, [ticketId, fetchDiagnosis]);

  useTicketSocket(undefined, handleAgentEscalatedToN2);

  const fetchMediaUrl = async (mediaId: string) => {
    if (mediaUrls[mediaId] || loadingUrls[mediaId]) return;
    setLoadingUrls((prev) => ({ ...prev, [mediaId]: true }));
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch(`${API_URL}/api/media/${mediaId}/url`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch media URL: ${response.statusText}`);
      const data = await response.json();
      setMediaUrls((prev) => ({ ...prev, [mediaId]: data.url }));
    } catch (err) {
      console.error('Error fetching media URL:', err);
    } finally {
      setLoadingUrls((prev) => ({ ...prev, [mediaId]: false }));
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      await ticketsApi.deleteTicket(ticketId);
      router.push('/dashboard/tickets');
    } catch (err) {
      toast.error('Erreur lors de la suppression du ticket');
      console.error('Error deleting ticket:', err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRefresh = useCallback(() => {
    fetchTicket();
    fetchDiagnosis();
  }, [fetchTicket, fetchDiagnosis]);

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-10 flex items-center h-14 px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        {/* Left: breadcrumb + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            href="/dashboard/tickets"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
          >
            ←
          </Link>
          <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">/</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[260px]">
            {ticket?.title ?? 'Ticket'}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0" style={{ height: 'calc(100vh - 56px)' }}>

        {/* ── LEFT PANE ── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">

          {/* Error state */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center mb-6">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchTicket}>
                Retry
              </Button>
            </div>
          )}

          {/* ── N1→N2 ESCALATION NOTIFICATION ── */}
          {n2Notification && (
            <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  AI Agent: N1 analysis complete — N2 action planning started
                </p>
                {n2Notification.n1Summary && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 line-clamp-2">
                    {n2Notification.n1Summary}
                  </p>
                )}
                <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                  {new Date(n2Notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => setN2Notification(null)}
                className="flex-shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 text-xs"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {ticket && !error && (
            <>
              {/* ── TICKET HEADER ── */}
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {ticket.title}
                </h1>
                <div className="flex flex-wrap gap-2 mb-3">
                  <StatusBadge status={ticket.status} />
                  <TypeBadge type={ticket.type} />
                  <SeverityBadge severity={ticket.severity} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {ticket.reporter && (
                    <span className="text-xs text-gray-400">
                      Reported by{' '}
                      <span className="font-medium text-gray-500">
                        {ticket.reporter.name || ticket.reporter.email}
                      </span>
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                  {ticket.application && (
                    <span className="text-xs text-gray-400">
                      App:{' '}
                      <span className="font-medium text-gray-500">{ticket.application.name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="border-b border-gray-100 dark:border-gray-800 mb-6" />

              {/* ── DESCRIPTION ── */}
              <div className="mb-6">
                <SectionHeader
                  label="Description"
                  open={descOpen}
                  onToggle={() => setDescOpen((v) => !v)}
                />
                {descOpen && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {ticket.description}
                  </p>
                )}
              </div>

              {/* ── USER CONTEXT ── */}
              {ticket.userContext && Object.keys(ticket.userContext).length > 0 && (
                <div className="mb-6">
                  <SectionHeader
                    label="User Context"
                    open={contextOpen}
                    onToggle={() => setContextOpen((v) => !v)}
                  />
                  {contextOpen && (
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(ticket.userContext).map(([key, value]) => (
                        <div
                          key={key}
                          className="bg-gray-100 dark:bg-gray-800 rounded px-2 py-1"
                        >
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:{' '}
                          </span>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 break-all">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── RECORDING ── */}
              {ticket.media && ticket.media.length > 0 && (
                <div className="mb-6">
                  <SectionHeader
                    label="Recording"
                    open={recordingOpen}
                    onToggle={() => setRecordingOpen((v) => !v)}
                  />
                  {recordingOpen && (
                    <div className="space-y-4">
                      {ticket.media.map((media) => {
                        const filename =
                          media.metadata?.originalFilename ||
                          media.storageKey.split('/').pop() ||
                          'video';
                        const isVideo =
                          media.type === 'video' || media.mimeType?.startsWith('video/');
                        const fileSize =
                          typeof media.fileSize === 'bigint'
                            ? Number(media.fileSize)
                            : media.fileSize || 0;

                        if (media.processingStatus === 'completed' && isVideo) {
                          return (
                            <div key={media.id}>
                              {mediaUrls[media.id] ? (
                                <VideoPlayer
                                  src={mediaUrls[media.id]!}
                                  title={filename}
                                  mimeType={media.mimeType ?? undefined}
                                  onError={(err) => console.error('Video error:', err)}
                                />
                              ) : (
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-800">
                                  {loadingUrls[media.id] ? (
                                    <div className="space-y-2">
                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                                      <p className="text-sm text-gray-500">Loading video...</p>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => fetchMediaUrl(media.id)}
                                    >
                                      Load Video
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div
                            key={media.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {filename}
                              </p>
                              <p className="text-xs text-gray-400">
                                {media.type} · {(fileSize / 1024 / 1024).toFixed(2)} MB ·{' '}
                                {media.processingStatus}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </>
          )}
        </div>

        {/* ── RIGHT PANE (always dark, 460px wide) ── */}
        <div
          className="w-[460px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ background: '#111827' }}
        >
          {/* DIAGNOSIS SECTION */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex-shrink-0">
            <DiagnosisPanelV3A
              diagnosis={diagnosis}
              isLoading={isDiagnosisLoading}
            />
          </div>

          {/* AGENT SECTION */}
          <AgentSection
            ticketId={ticketId}
            onDiagnosisUpdate={fetchDiagnosis}
            diagnosis={diagnosis}
          />

        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le ticket"
        message="Êtes-vous sûr de vouloir supprimer ce ticket ?\n\nCette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
