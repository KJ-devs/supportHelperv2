'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Badge, Input, EmptyState } from '@/components/ui';
import {
  auditLogsApi,
  type AuditLog,
  type AuditLogsFilters,
} from '@/lib/api/audit-logs';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'connect_github', label: 'Connect GitHub' },
  { value: 'disconnect_github', label: 'Disconnect GitHub' },
  { value: 'configure_ai', label: 'Configure AI' },
  { value: 'link_repo', label: 'Link Repository' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'user', label: 'User' },
  { value: 'application', label: 'Application' },
  { value: 'settings', label: 'Settings' },
  { value: 'github', label: 'GitHub' },
  { value: 'integration', label: 'Integration' },
  { value: 'agent', label: 'Agent' },
];

const ITEMS_PER_PAGE_OPTIONS = [
  { value: 25, label: '25 per page' },
  { value: 50, label: '50 per page' },
  { value: 100, label: '100 per page' },
];

export default function AuditLogPage() {
  const { isLoading: authLoading } = useRequireAuth();

  // Data state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Applied filters (used for actual API call)
  const [appliedFilters, setAppliedFilters] = useState<AuditLogsFilters>({
    page: 0,
    limit: 50,
  });

  // Expanded log details
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Feature gate state
  const [isFeatureUnavailable, setIsFeatureUnavailable] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setIsFeatureUnavailable(false);
      const response = await auditLogsApi.getLogs(appliedFilters);
      setLogs(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      if (err.statusCode === 403) {
        setIsFeatureUnavailable(true);
        setLogs([]);
      } else {
        showToast('error', err.message || 'Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, showToast]);

  // Initial load
  useEffect(() => {
    if (!authLoading) {
      fetchLogs();
    }
  }, [authLoading, fetchLogs]);

  // Apply filters
  const handleApplyFilters = () => {
    setAppliedFilters({
      actorId: actorFilter.trim() || undefined,
      action: actionFilter || undefined,
      resourceType: resourceTypeFilter || undefined,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
      page: 0, // Reset to first page
      limit: appliedFilters.limit,
    });
  };

  // Reset filters
  const handleResetFilters = () => {
    setActorFilter('');
    setActionFilter('');
    setResourceTypeFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setAppliedFilters({
      page: 0,
      limit: appliedFilters.limit,
    });
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (pagination.page > 0) {
      setAppliedFilters((prev) => ({
        ...prev,
        page: pagination.page - 1,
      }));
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages - 1) {
      setAppliedFilters((prev) => ({
        ...prev,
        page: pagination.page + 1,
      }));
    }
  };

  const handleChangeLimit = (limit: number) => {
    setAppliedFilters((prev) => ({
      ...prev,
      limit,
      page: 0, // Reset to first page
    }));
  };

  // Export CSV
  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await auditLogsApi.exportLogs(appliedFilters);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('success', 'Audit logs exported successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  // Get action color
  const getActionColor = (action: string): string => {
    if (action.includes('create')) return 'text-green-600 dark:text-green-400';
    if (action.includes('delete')) return 'text-red-600 dark:text-red-400';
    if (action.includes('update')) return 'text-blue-600 dark:text-blue-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  // Get actor type badge variant
  const getActorTypeBadgeVariant = (
    actorType: string
  ): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (actorType) {
      case 'user':
        return 'info';
      case 'system':
        return 'warning';
      case 'agent':
        return 'success';
      default:
        return 'default';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{toast.type === 'success' ? 'OK' : '!'}</span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <a
                  href="/dashboard/settings"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Settings
                </a>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span className="text-sm text-gray-900 dark:text-white font-medium">
                  Audit Logs
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Audit Logs
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Track all actions performed on your platform
              </p>
            </div>
            <Button
              onClick={handleExport}
              isLoading={exporting}
              disabled={isFeatureUnavailable || logs.length === 0}
              variant="secondary"
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Feature Gate Notice */}
        {isFeatureUnavailable && (
          <Card>
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20 mb-4">
                <svg
                  className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Feature Not Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Audit logs require a Pro or Enterprise plan. Upgrade to access this feature.
              </p>
              <Button variant="primary">Upgrade Plan</Button>
            </div>
          </Card>
        )}

        {/* Filters */}
        {!isFeatureUnavailable && (
          <Card className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {/* Actor Filter */}
              <Input
                type="text"
                placeholder="Search by actor ID or name"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />

              {/* Action Filter */}
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Resource Type Filter */}
              <select
                value={resourceTypeFilter}
                onChange={(e) => setResourceTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RESOURCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Start Date */}
              <Input
                type="date"
                placeholder="Start date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />

              {/* End Date */}
              <Input
                type="date"
                placeholder="End date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>

            {/* Filter Actions */}
            <div className="flex gap-3">
              <Button onClick={handleApplyFilters} size="sm">
                Apply Filters
              </Button>
              <Button onClick={handleResetFilters} variant="ghost" size="sm">
                Reset
              </Button>
            </div>
          </Card>
        )}

        {/* Logs Table */}
        {!isFeatureUnavailable && (
          <Card>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                <span className="ml-3 text-sm text-gray-500">
                  Loading audit logs...
                </span>
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
                title="No audit logs found"
                description="Actions will be recorded here automatically. User logins, ticket operations, and settings changes will all appear in this audit trail."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        IP Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-gray-200 dark:border-gray-700 even:bg-gray-50 dark:even:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col space-y-1">
                            <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                              {log.actorId.substring(0, 8)}...
                            </span>
                            <Badge variant={getActorTypeBadgeVariant(log.actorType)}>
                              {log.actorType}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${getActionColor(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-gray-900 dark:text-gray-100 font-medium">
                              {log.resourceType}
                            </span>
                            {log.resourceId && (
                              <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                                {log.resourceId.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {log.details ? (
                            <button
                              onClick={() =>
                                setExpandedLogId(
                                  expandedLogId === log.id ? null : log.id
                                )
                              }
                              className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                            >
                              {expandedLogId === log.id ? 'Hide' : 'Show'}
                            </button>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600 text-xs">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Expanded Details */}
                {expandedLogId && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Details
                    </h4>
                    <pre className="text-xs bg-white dark:bg-gray-900 rounded-lg p-3 overflow-x-auto text-gray-900 dark:text-gray-100 font-mono border border-gray-200 dark:border-gray-700">
                      {JSON.stringify(
                        logs.find((l) => l.id === expandedLogId)?.details,
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Pagination */}
            {!loading && logs.length > 0 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Items per page:
                  </span>
                  <select
                    value={pagination.limit}
                    onChange={(e) => handleChangeLimit(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {pagination.page + 1} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handlePreviousPage}
                      disabled={pagination.page === 0}
                      variant="secondary"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={handleNextPage}
                      disabled={pagination.page >= pagination.totalPages - 1}
                      variant="secondary"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
