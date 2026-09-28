/**
 * Ticket Detail Page — Version B "Diagnostic-First"
 * Diagnosis hero card in left pane + chat-only right pane (400px)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { ticketsApi } from '@/lib/api/tickets';
import { agentTasksApi } from '@/lib/api/agent-tasks';
import { getTicketDiagnosis } from '@/lib/api/agent-v2';
import type { Ticket } from '@/lib/types/ticket';
import type { Diagnosis } from '@/components/diagnosis/DiagnosisPanelV3A';
import { AgentSection } from '@/components/agent-chat/AgentSection';
import {
  PageLoader,
  StatusBadge,
  SeverityBadge,
  TypeBadge,
  Button,
  ConfirmModal,
  useToast,
} from '@/components/ui';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { N1AssessmentBadge } from '@/components/n1-assessment/N1AssessmentBadge';
import { RelatedTicketsSection } from '@/components/ticket-relations/RelatedTicketsSection';
import type { N1Assessment } from '@/lib/types/ticket';
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  Bot,
  GitPullRequest,
  ExternalLink,
  Loader2,
  ChevronDown,
  Rocket,
  Search,
  FileCode,
  Lightbulb,
  User,
  Clock,
  AppWindow,
  MessageSquare,
} from 'lucide-react';
import type { AgentTask } from '@/lib/api/agent-tasks';
import { useTicketSocket, type AgentEscalatedToN2Event } from '@/hooks/useTicketSocket';
import { useTranslations } from 'next-intl';

// --- Analyser popover constants ---

const ANALYSIS_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
] as const;

function getStoredModel(): string {
  if (typeof window === 'undefined') return ANALYSIS_MODELS[0].id;
  return localStorage.getItem('analyser_model') ?? ANALYSIS_MODELS[0].id;
}

function getStoredMode(): 'autonomous' | 'guided' {
  if (typeof window === 'undefined') return 'autonomous';
  const v = localStorage.getItem('analyser_mode');
  return v === 'guided' ? 'guided' : 'autonomous';
}

// --- Confidence helpers ---

function confidencePercent(c: number | undefined | null): number {
  if (typeof c !== 'number' || isNaN(c)) return 0;
  return c > 1 ? c : Math.round(c * 100);
}

function confidenceBarColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function confidenceTextColor(pct: number): string {
  if (pct >= 80) return 'text-green-600 dark:text-green-400';
  if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function relevanceDotColor(relevance: string): string {
  if (relevance === 'primary') return 'bg-red-500';
  if (relevance === 'secondary') return 'bg-yellow-500';
  return 'bg-gray-400';
}

// --- Format user context key ---

function formatContextKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

// --- Section label (non-collapsible) ---

function SectionLabel({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

// --- Main page ---

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoading: authLoading } = useRequireAuth();
  const toast = useToast();
  const t = useTranslations('tickets.detail');

  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [isDiagnosisLoading, setIsDiagnosisLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [latestTask, setLatestTask] = useState<AgentTask | null>(null);

  // Media pre-signed URLs
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});

  // N1→N2 escalation notification
  const [n2Notification, setN2Notification] = useState<AgentEscalatedToN2Event | null>(null);

  // Analyser popover state
  const [analysisPopoverOpen, setAnalysisPopoverOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(ANALYSIS_MODELS[0].id);
  const [selectedMode, setSelectedMode] = useState<'autonomous' | 'guided'>('autonomous');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Restore persisted preferences once on mount
  useEffect(() => {
    setSelectedModel(getStoredModel());
    setSelectedMode(getStoredMode());
  }, []);

  // Close popover on click outside
  useEffect(() => {
    if (!analysisPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAnalysisPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [analysisPopoverOpen]);

  const fetchTicket = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await ticketsApi.getTicket(ticketId);
      setTicket(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  const fetchDiagnosis = useCallback(async () => {
    try {
      setIsDiagnosisLoading(true);
      const data = await getTicketDiagnosis(ticketId);
      setDiagnosis(data);
    } catch {
      // No diagnosis yet — that's fine
    } finally {
      setIsDiagnosisLoading(false);
    }
  }, [ticketId]);

  const fetchLatestTask = useCallback(async () => {
    try {
      const tasks = await agentTasksApi.getTasksByTicket(ticketId);
      if (tasks.length > 0) {
        const completed = tasks.find(t => t.prUrl);
        setLatestTask(completed ?? tasks[0] ?? null);
      }
    } catch {
      // silently ignore
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading && ticketId) {
      fetchTicket();
      fetchDiagnosis();
      fetchLatestTask();
    }
  }, [ticketId, authLoading, fetchTicket, fetchDiagnosis, fetchLatestTask]);

  const handleAgentEscalatedToN2 = useCallback(
    (event: AgentEscalatedToN2Event) => {
      if (event.ticketId === ticketId) {
        setN2Notification(event);
        fetchDiagnosis();
      }
    },
    [ticketId, fetchDiagnosis]
  );

  useTicketSocket(undefined, handleAgentEscalatedToN2);

  // Auto-fetch media URLs on mount
  const fetchMediaUrl = useCallback(
    async (mediaId: string) => {
      if (mediaUrls[mediaId] || loadingUrls[mediaId]) return;
      setLoadingUrls(prev => ({ ...prev, [mediaId]: true }));
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const response = await fetch(`${API_URL}/api/media/${mediaId}/url`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
        const data = await response.json();
        setMediaUrls(prev => ({ ...prev, [mediaId]: data.url }));
      } catch (err) {
        console.error('Error fetching media URL:', err);
      } finally {
        setLoadingUrls(prev => ({ ...prev, [mediaId]: false }));
      }
    },
    [mediaUrls, loadingUrls]
  );

  // Auto-load video URLs when ticket loads
  useEffect(() => {
    if (!ticket?.media) return;
    for (const media of ticket.media) {
      const isVideo = media.type === 'video' || media.mimeType?.startsWith('video/');
      if (media.processingStatus === 'completed' && isVideo) {
        fetchMediaUrl(media.id);
      }
    }
  }, [ticket?.media, fetchMediaUrl]);

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      await ticketsApi.deleteTicket(ticketId);
      router.push('/dashboard/tickets');
    } catch {
      toast.error(t('deleteError'));
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRefresh = useCallback(() => {
    fetchTicket();
    fetchDiagnosis();
    fetchLatestTask();
  }, [fetchTicket, fetchDiagnosis, fetchLatestTask]);

  const MANUAL_STATUSES = [
    'open',
    'in_progress',
    'pending',
    'waiting',
    'waiting_response',
    'escalated',
    'resolved',
    'closed',
  ] as const;

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || newStatus === ticket.status) return;
    const previousStatus = ticket.status;
    setTicket(prev => (prev ? { ...prev, status: newStatus as Ticket['status'] } : null));
    setIsUpdatingStatus(true);
    try {
      await ticketsApi.updateTicket(ticketId, { status: newStatus as Ticket['status'] });
      toast.success(t('statusUpdated'));
    } catch (err: unknown) {
      setTicket(prev => (prev ? { ...prev, status: previousStatus } : null));
      toast.error(err instanceof Error ? err.message : t('statusUpdateError'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    setAnalysisPopoverOpen(false);
    try {
      setIsAnalyzing(true);
      localStorage.setItem('analyser_model', selectedModel);
      localStorage.setItem('analyser_mode', selectedMode);
      const task = await agentTasksApi.triggerAnalysis(ticketId, {
        model: selectedModel,
        agentMode: selectedMode,
      });
      toast.success(t('analyzeSuccess'));
      router.push(`/dashboard/agent-tasks/${task.id}`);
    } catch (err: any) {
      toast.error(err.message || t('analyzeError'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Computed values ---
  const shortId = ticketId.substring(0, 8);
  const pct = confidencePercent(diagnosis?.confidence);

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-10 flex items-center h-14 px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            href="/dashboard/tickets"
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
          >
            ←
          </Link>
          <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">/</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[300px]">
            {ticket?.title ?? 'Ticket'}
          </span>
          <code className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
            #{shortId}
          </code>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {ticket && (
            <select
              aria-label={t('statusLabel')}
              value={ticket.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={isUpdatingStatus}
              className="h-8 px-2 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {MANUAL_STATUSES.map(s => (
                <option key={s} value={s}>
                  {t(`manualStatuses.${s}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="flex items-center">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0" style={{ height: 'calc(100vh - 56px)' }}>
        {/* ── LEFT PANE ── */}
        <div className="flex-1 overflow-y-auto px-8 py-8 bg-white dark:bg-gray-900">
          {/* Error state */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center mb-8">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={fetchTicket}>
                {t('retry')}
              </Button>
            </div>
          )}

          {/* N1→N2 escalation notification */}
          {n2Notification && (
            <div className="mb-6 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {t('n2Notification')}
                </p>
                {n2Notification.n1Summary && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 line-clamp-2">
                    {n2Notification.n1Summary}
                  </p>
                )}
              </div>
              <button
                onClick={() => setN2Notification(null)}
                className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
                aria-label={t('dismiss')}
              >
                ×
              </button>
            </div>
          )}

          {ticket && !error && (
            <div className="space-y-8">
              {/* ── TICKET HEADER ── */}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  {ticket.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <StatusBadge status={ticket.status} />
                  <TypeBadge type={ticket.type} />
                  <SeverityBadge severity={ticket.severity} />
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                  {ticket.reporter && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3 h-3" aria-hidden="true" />
                      <span className="font-medium text-gray-500 dark:text-gray-400">
                        {ticket.reporter.name || ticket.reporter.email}
                      </span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {new Date(ticket.createdAt).toLocaleString()}
                  </span>
                  {ticket.application && (
                    <span className="flex items-center gap-1.5">
                      <AppWindow className="w-3 h-3" aria-hidden="true" />
                      <span className="font-medium text-gray-500 dark:text-gray-400">
                        {ticket.application.name}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* ── DIAGNOSIS HERO CARD ── */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-5">
                {isDiagnosisLoading ? (
                  /* Loading skeleton */
                  <div className="animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-32 bg-blue-200 dark:bg-blue-800 rounded" />
                      <div className="flex-1 h-2 bg-blue-200 dark:bg-blue-800 rounded-full" />
                    </div>
                    <div className="h-4 w-3/4 bg-blue-200 dark:bg-blue-800 rounded" />
                    <div className="h-4 w-1/2 bg-blue-200 dark:bg-blue-800 rounded" />
                  </div>
                ) : diagnosis ? (
                  /* Diagnosis content */
                  <div className="space-y-4">
                    {/* Header: label + confidence bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Search
                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                          Diagnostic IA
                        </span>
                      </div>
                      <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${confidenceBarColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${confidenceTextColor(pct)}`}>
                        {pct}%
                      </span>
                    </div>

                    {/* Root cause */}
                    <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                      {diagnosis.rootCause}
                    </p>

                    {/* Affected files */}
                    {diagnosis.affectedFiles && diagnosis.affectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {diagnosis.affectedFiles.map((file, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-blue-200/50 dark:border-blue-700/30 text-xs"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${relevanceDotColor(file.relevance)}`}
                            />
                            <FileCode className="w-3 h-3 text-gray-400" aria-hidden="true" />
                            <span className="font-mono text-gray-700 dark:text-gray-300">
                              {file.filePath.split('/').pop()}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested fix */}
                    {diagnosis.suggestedFix && (
                      <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border border-blue-100 dark:border-blue-800/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-yellow-500" aria-hidden="true" />
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            Suggestion
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {diagnosis.suggestedFix}
                        </p>
                      </div>
                    )}

                    {/* CTA buttons */}
                    <div className="flex items-center gap-3 pt-1">
                      <div className="relative" ref={popoverRef}>
                        <button
                          data-testid="analyser-button"
                          type="button"
                          disabled={isAnalyzing}
                          onClick={() => setAnalysisPopoverOpen(v => !v)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {isAnalyzing ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Bot className="w-4 h-4" aria-hidden="true" />
                          )}
                          {t('analyze')}
                          <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                        </button>

                        {analysisPopoverOpen && (
                          <div
                            data-testid="analyser-popover"
                            className="absolute left-0 top-full mt-2 z-50 min-w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4"
                          >
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                              {t('analyserModel')}
                            </p>
                            <div className="flex flex-col gap-1.5 mb-4">
                              {ANALYSIS_MODELS.map(m => (
                                <label
                                  key={m.id}
                                  className="flex items-center gap-2 cursor-pointer group"
                                >
                                  <input
                                    type="radio"
                                    name="analysis-model"
                                    value={m.id}
                                    checked={selectedModel === m.id}
                                    onChange={() => setSelectedModel(m.id)}
                                    className="accent-blue-600"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {m.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                              {t('analyserMode')}
                            </p>
                            <div className="flex gap-2 mb-4">
                              {(['autonomous', 'guided'] as const).map(mode => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setSelectedMode(mode)}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                    selectedMode === mode
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                                  }`}
                                >
                                  {mode === 'autonomous'
                                    ? t('analyserAutonomous')
                                    : t('analyserGuided')}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={handleTriggerAnalysis}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                            >
                              <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
                              {t('analyserLaunch')}
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          // Scroll focus to chat input in right pane
                          const chatInput = document.querySelector('textarea[placeholder]');
                          if (chatInput instanceof HTMLElement) chatInput.focus();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" aria-hidden="true" />
                        Discuter avec l&apos;agent
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty state — no diagnosis yet */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                        <Bot
                          className="w-5 h-5 text-blue-600 dark:text-blue-400"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Aucun diagnostic disponible
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Lancez l&apos;analyse IA pour diagnostiquer ce ticket
                        </p>
                      </div>
                    </div>
                    <div className="relative" ref={!diagnosis ? popoverRef : undefined}>
                      <button
                        data-testid="analyser-button-empty"
                        type="button"
                        disabled={isAnalyzing}
                        onClick={() => setAnalysisPopoverOpen(v => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Rocket className="w-4 h-4" aria-hidden="true" />
                        )}
                        {t('analyze')}
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
                      </button>

                      {analysisPopoverOpen && !diagnosis && (
                        <div
                          data-testid="analyser-popover"
                          className="absolute right-0 top-full mt-2 z-50 min-w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4"
                        >
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            {t('analyserModel')}
                          </p>
                          <div className="flex flex-col gap-1.5 mb-4">
                            {ANALYSIS_MODELS.map(m => (
                              <label
                                key={m.id}
                                className="flex items-center gap-2 cursor-pointer group"
                              >
                                <input
                                  type="radio"
                                  name="analysis-model-empty"
                                  value={m.id}
                                  checked={selectedModel === m.id}
                                  onChange={() => setSelectedModel(m.id)}
                                  className="accent-blue-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {m.label}
                                </span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            {t('analyserMode')}
                          </p>
                          <div className="flex gap-2 mb-4">
                            {(['autonomous', 'guided'] as const).map(mode => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setSelectedMode(mode)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  selectedMode === mode
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                                }`}
                              >
                                {mode === 'autonomous'
                                  ? t('analyserAutonomous')
                                  : t('analyserGuided')}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleTriggerAnalysis}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                          >
                            <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
                            {t('analyserLaunch')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── RESOLUTION ROW (N1 + PR) ── */}
              {(ticket.n1Decision || latestTask) && (
                <div className="grid grid-cols-2 gap-4">
                  {/* N1 Assessment */}
                  <div>
                    {ticket.n1Decision && (
                      <N1AssessmentBadge
                        assessment={ticket.n1Assessment as N1Assessment | null}
                        decision={ticket.n1Decision}
                        assessedAt={ticket.n1AssessedAt}
                        ticketId={ticketId}
                        onOverride={handleRefresh}
                      />
                    )}
                  </div>

                  {/* PR Status */}
                  <div>
                    {latestTask && (
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-full">
                        <div className="flex items-start gap-3">
                          <GitPullRequest
                            className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          {latestTask.prUrl ? (
                            <div className="min-w-0 flex-1">
                              <a
                                href={latestTask.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5"
                              >
                                PR #{latestTask.prNumber}
                                <ExternalLink
                                  className="w-3 h-3 flex-shrink-0"
                                  aria-hidden="true"
                                />
                              </a>
                              {latestTask.branchName && (
                                <code className="mt-1.5 block text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono truncate">
                                  {latestTask.branchName}
                                </code>
                              )}
                            </div>
                          ) : [
                              'analyzing',
                              'plan_ready',
                              'plan_approved',
                              'generating',
                              'pushing',
                            ].includes(latestTask.status) ? (
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                              {t('prInProgress')}
                            </span>
                          ) : latestTask.status === 'failed' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-red-500">{t('prFailed')}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  agentTasksApi.retryTask(latestTask.id).then(fetchLatestTask)
                                }
                              >
                                {t('retry')}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── DESCRIPTION ── */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 border-l-4 border-l-blue-400 p-5">
                <SectionLabel label={t('sectionDescription')} />
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>

              {/* ── EVIDENCE: USER CONTEXT + RECORDING ── */}
              <div className="grid grid-cols-5 gap-6">
                {/* Context (3/5) */}
                <div className="col-span-3">
                  <SectionLabel label={t('sectionContext')} />
                  {ticket.userContext && Object.keys(ticket.userContext).length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(ticket.userContext).map(([key, value]) => {
                        const displayValue =
                          typeof value === 'object' ? JSON.stringify(value) : String(value);
                        return (
                          <div
                            key={key}
                            className="bg-gray-50 dark:bg-gray-800/80 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-700/50"
                          >
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                              {formatContextKey(key)}
                            </p>
                            <p
                              className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate"
                              title={displayValue}
                            >
                              {displayValue}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                      {t('noContext')}
                    </p>
                  )}
                </div>

                {/* Recording (2/5) */}
                <div className="col-span-2">
                  <SectionLabel label={t('sectionRecording')} />
                  {(!ticket.media || ticket.media.length === 0) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic py-4">
                      {t('noRecording')}
                    </p>
                  )}
                  {ticket.media && ticket.media.length > 0 && (
                    <div className="space-y-3">
                      {ticket.media.map(media => {
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
                                  onError={err => console.error('Video error:', err)}
                                />
                              ) : (
                                <div className="flex items-center justify-center py-8 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
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
              </div>

              {/* ── RELATED TICKETS ── */}
              <RelatedTicketsSection ticketId={ticketId} />
            </div>
          )}
        </div>

        {/* ── RIGHT PANE — AI ASSISTANT (400px, dark) ── */}
        <div className="w-[400px] flex-shrink-0 flex flex-col bg-gray-900 dark:bg-gray-950">
          {/* Agent section fills full height */}
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
        title={t('deleteConfirm')}
        message={t('deleteMessage')}
        confirmLabel={t('deleteConfirm')}
        cancelLabel={t('dismiss')}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
