'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { agentTasksApi } from '@/lib/api/agent-tasks';
import type {
  AgentTask,
  AgentTaskFilters,
  AgentTaskStats,
  PaginatedResponse,
} from '@/lib/api/agent-tasks';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Button } from '@/components/ui';
import { Pagination } from '@/components/tickets/Pagination';
import { AgentTaskMetrics } from './components/AgentTaskMetrics';
import { AgentTaskTable } from './components/AgentTaskTable';
import { AgentTaskFiltersBar } from './components/AgentTaskFilters';

export default function AgentTasksPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [stats, setStats] = useState<AgentTaskStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AgentTaskFilters>({
    page: 1,
    limit: 20,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response: PaginatedResponse<AgentTask> = await agentTasksApi.getTasks(filters);
      setTasks(response.data);
      setPagination({
        ...response.pagination,
        page: response.pagination.page + 1,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading agent tasks');
      console.error('Error fetching agent tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await agentTasksApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchTasks();
      fetchStats();
    }
  }, [authLoading, fetchTasks, fetchStats]);

  const handleFiltersChange = (newFilters: AgentTaskFilters) => {
    setFilters({ ...newFilters });
  };

  const handleResetFilters = () => {
    setFilters({ page: 1, limit: 20 });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetry = async (id: string) => {
    try {
      await agentTasksApi.retryTask(id);
      fetchTasks();
      fetchStats();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to retry task');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this task?')) return;
    try {
      await agentTasksApi.cancelTask(id);
      fetchTasks();
      fetchStats();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  };

  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Agent Tasks
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Monitor and manage AI agent analysis tasks
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { fetchTasks(); fetchStats(); }}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-6">
          <AgentTaskMetrics stats={stats} isLoading={statsLoading} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <AgentTaskFiltersBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleResetFilters}
          />
        </div>

        {/* Info bar */}
        <div className="mb-4 bg-white dark:bg-gray-900 p-3 rounded-lg shadow">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-gray-100">{pagination.total}</span>{' '}
              task(s) total
            </span>
            {isLoading && (
              <div className="flex items-center text-gray-500 dark:text-gray-400">
                <svg
                  className="animate-spin h-4 w-4 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchTasks} className="ml-auto">
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
          <AgentTaskTable
            tasks={tasks}
            isLoading={isLoading}
            onRetry={handleRetry}
            onCancel={handleCancel}
          />

          {/* Pagination */}
          {!isLoading && tasks.length > 0 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
