'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { integrationsApi } from '@/lib/api/integrations';
import type { IntegrationSyncLog, IntegrationSyncStats } from '@/lib/types/integration';
import { Modal, Button, Select, Loader } from '@/components/ui';

interface SyncLogsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  integrationId: string;
  integrationName: string;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SyncLogsPanel({
  isOpen,
  onClose,
  integrationId,
  integrationName,
}: SyncLogsPanelProps) {
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [stats, setStats] = useState<IntegrationSyncStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 10;

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
          action: actionFilter || undefined,
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
  }, [isOpen, integrationId, page, statusFilter, actionFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (newStatus: string, newAction: string) => {
    setStatusFilter(newStatus);
    setActionFilter(newAction);
    setPage(1);
  };

  const handleRowClick = (log: IntegrationSyncLog) => {
    if (log.status === 'failed' && log.error) {
      setExpandedLogId(expandedLogId === log.id ? null : log.id);
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'retrying':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionBadgeStyles = (action?: string) => {
    switch (action) {
      case 'create':
        return 'bg-blue-100 text-blue-800';
      case 'update':
        return 'bg-purple-100 text-purple-800';
      case 'delete':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sync Logs - ${integrationName}`} size="xl">
      <div className="space-y-4">
        {/* Stats Bar */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Syncs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.total}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Success Rate</p>
              <p className={`text-2xl font-bold mt-1 ${getSuccessRateColor(stats.successRate)}`}>
                {stats.successRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Successful</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.success}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Failed</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value, actionFilter)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'success', label: 'Success' },
              { value: 'failed', label: 'Failed' },
              { value: 'retrying', label: 'Retrying' },
            ]}
            placeholder="Filter by status"
          />
          <Select
            value={actionFilter}
            onChange={(e) => handleFilterChange(statusFilter, e.target.value)}
            options={[
              { value: '', label: 'All Actions' },
              { value: 'create', label: 'Create' },
              { value: 'update', label: 'Update' },
              { value: 'delete', label: 'Delete' },
            ]}
            placeholder="Filter by action"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader size="md" text="Loading sync logs..." />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && logs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-gray-600 dark:text-gray-400">No sync logs found</p>
            {(statusFilter || actionFilter) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Try adjusting your filters</p>
            )}
          </div>
        )}

        {/* Logs Table */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="overflow-x-auto border dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => handleRowClick(log)}
                      className={`${
                        log.status === 'failed' && log.error ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {timeAgo(log.syncedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div
                          className="max-w-xs truncate"
                          title={log.ticket?.title || 'Unknown Ticket'}
                        >
                          {log.ticket?.title || 'Unknown Ticket'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeStyles(
                            log.action
                          )}`}
                        >
                          {log.action || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyles(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {log.externalUrl ? (
                          <a
                            href={log.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg
                              className="w-4 h-4"
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
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                    {expandedLogId === log.id && log.error && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-red-50 dark:bg-red-900/20">
                          <div className="text-sm">
                            <p className="font-medium text-red-800 dark:text-red-300 mb-1">Error Details:</p>
                            <p className="text-red-700 dark:text-red-400 font-mono text-xs whitespace-pre-wrap">
                              {log.error}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && logs.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
