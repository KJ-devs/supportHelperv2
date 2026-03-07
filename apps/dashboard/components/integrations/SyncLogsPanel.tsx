'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { integrationsApi } from '@/lib/api/integrations';
import type { IntegrationSyncLog, IntegrationSyncStats } from '@/lib/types/integration';
import { Loader } from '@/components/ui';

interface SyncLogsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  integrationId: string;
  integrationName: string;
}

function timeAgoRaw(dateString: string): string | 'just_now' {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just_now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDuration(ms?: number): string {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getStatusBadgeStyles(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'retrying':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getActionBadgeStyles(action?: string): string {
  switch (action) {
    case 'create':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'update':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'delete':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function getSuccessRateStrokeColor(rate: number): string {
  if (rate >= 90) return '#16a34a';
  if (rate >= 70) return '#ca8a04';
  return '#dc2626';
}

function getTimelineDotBorderColor(status: string): string {
  switch (status) {
    case 'success':
      return 'border-green-500';
    case 'failed':
      return 'border-red-500';
    case 'retrying':
      return 'border-yellow-500';
    default:
      return 'border-gray-400';
  }
}

export function SyncLogsPanel({
  isOpen,
  onClose,
  integrationId,
  integrationName,
}: SyncLogsPanelProps) {
  const t = useTranslations('syncLogs');

  const timeAgo = (dateString: string): string => {
    const raw = timeAgoRaw(dateString);
    if (raw === 'just_now') return t('justNow');
    return raw;
  };

  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [stats, setStats] = useState<IntegrationSyncStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 10;

  // Animate in
  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger CSS transition
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    // Wait for animation to finish before calling onClose
    setTimeout(onClose, 300);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const fetchData = useCallback(async () => {
    if (!isOpen) return;

    try {
      setIsLoading(true);
      setError(null);

      const [logsData, statsData] = await Promise.all([
        integrationsApi.getSyncLogs(integrationId, {
          page: page - 1,
          limit,
          status: statusFilter || undefined,
        }),
        integrationsApi.getSyncStats(integrationId),
      ]);

      setLogs(logsData.data);
      setStats(statsData);
      setTotalPages(Math.ceil(logsData.total / limit));
    } catch (err: any) {
      setError(err.message || 'Failed to load sync logs');
      console.error('Error fetching sync logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, integrationId, page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const toggleExpanded = (log: IntegrationSyncLog) => {
    if (log.status === 'failed' && log.error) {
      setExpandedLogId(expandedLogId === log.id ? null : log.id);
    }
  };

  if (!isOpen) return null;

  const successRate = stats ? Math.round(stats.successRate) : 0;
  const rateColor = getSuccessRateStrokeColor(successRate);
  const statusFilters = ['all', 'success', 'failed', 'retrying'];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={`Sync logs for ${integrationName}`}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{integrationName}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            aria-label={t('close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Stats Section */}
            {stats && (
              <div className="flex items-center gap-6">
                {/* Success Rate Ring */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e5e7eb"
                      strokeWidth="4"
                      fill="none"
                      className="dark:stroke-gray-700"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={rateColor}
                      strokeWidth="4"
                      fill="none"
                      strokeDasharray={`${successRate * 1.76} 176`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900 dark:text-gray-100">
                    {successRate}%
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-1.5 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {stats.total}
                    </span>
                    <span>{t('totalSyncs')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {stats.success}
                    </span>
                    <span>{t('successful')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {stats.failed}
                    </span>
                    <span>{t('failed')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Chips */}
            <div className="flex gap-2 flex-wrap">
              {statusFilters.map(s => {
                const isActive = s === 'all' ? statusFilter === '' : statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleFilterChange(s === 'all' ? '' : s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center py-12">
                <Loader size="md" text={t('loading')} />
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
                >
                  {t('retry')}
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && logs.length === 0 && (
              <div className="text-center py-12">
                <svg
                  className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 font-medium">{t('noLogs')}</p>
                {statusFilter && (
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Try adjusting your filters
                  </p>
                )}
              </div>
            )}

            {/* Timeline Log Entries */}
            {!isLoading && !error && logs.length > 0 && (
              <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                {logs.map(log => (
                  <div key={log.id} className="relative pb-6 last:pb-0">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-[9px] w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-2 ${getTimelineDotBorderColor(
                        log.status
                      )}`}
                    />

                    <div className="ml-4">
                      {/* Timestamp */}
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {timeAgo(log.syncedAt)}
                      </p>

                      {/* Ticket Title */}
                      <p
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5 truncate max-w-xs"
                        title={log.ticket?.title || 'Unknown Ticket'}
                      >
                        {log.ticket?.title || 'Unknown Ticket'}
                      </p>

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {log.action && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadgeStyles(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyles(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDuration(log.durationMs)}
                        </span>
                        {log.externalUrl && (
                          <a
                            href={log.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            onClick={e => e.stopPropagation()}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}
                      </div>

                      {/* Expandable Error Details */}
                      {log.status === 'failed' && log.error && (
                        <>
                          <button
                            onClick={() => toggleExpanded(log)}
                            className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1"
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${
                                expandedLogId === log.id ? 'rotate-90' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            {t('errorDetails')}
                          </button>
                          {expandedLogId === log.id && (
                            <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                              <p className="text-xs text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap break-words">
                                {log.error}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer - Pagination */}
        {!isLoading && !error && logs.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-900">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              {t('prev')}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('next')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
