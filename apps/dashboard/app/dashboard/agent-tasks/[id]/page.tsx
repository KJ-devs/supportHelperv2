'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { agentTasksApi } from '@/lib/api/agent-tasks';
import type { AgentTask } from '@/lib/api/agent-tasks';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Button } from '@/components/ui';
import { AgentTaskStatusBadge } from '../components/AgentTaskStatusBadge';
import { AgentTaskDetail } from '../components/AgentTaskDetail';

export default function AgentTaskDetailPage() {
  const params = useParams();
  const { isLoading: authLoading } = useRequireAuth();

  const taskId = params.id as string;

  const [task, setTask] = useState<AgentTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await agentTasksApi.getTask(taskId);
      setTask(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading agent task');
      console.error('Error fetching agent task:', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!authLoading && taskId) {
      fetchTask();
    }
  }, [taskId, authLoading, fetchTask]);

  const handleRetry = async () => {
    if (!task) return;
    try {
      const updated = await agentTasksApi.retryTask(task.id);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to retry task');
    }
  };

  const handleCancel = async () => {
    if (!task) return;
    if (!confirm('Are you sure you want to cancel this task?')) return;
    try {
      const updated = await agentTasksApi.cancelTask(task.id);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel task');
    }
  };

  const handleApprove = async (phase: 'plan' | 'code') => {
    if (!task) return;
    try {
      const updated = await agentTasksApi.approveTask(task.id, phase);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to approve task');
    }
  };

  const handleReject = async (phase: 'plan' | 'code') => {
    if (!task) return;
    const reason = prompt('Reason for rejection (optional):');
    try {
      const updated = await agentTasksApi.rejectTask(task.id, phase, reason || undefined);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reject task');
    }
  };

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/agent-tasks"
            className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4"
          >
            &larr; Back to Agent Tasks
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Agent Task Detail
              </h1>
              {task && <AgentTaskStatusBadge status={task.status} />}
            </div>

            {task && (
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm" onClick={fetchTask}>
                  Refresh
                </Button>
                {task.status === 'plan_pending_review' && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => handleApprove('plan')}>
                      Approve Plan
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleReject('plan')}>
                      Reject Plan
                    </Button>
                  </>
                )}
                {task.status === 'code_pending_review' && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => handleApprove('code')}>
                      Approve Code
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleReject('code')}>
                      Reject Code
                    </Button>
                  </>
                )}
                {['failed', 'expired'].includes(task.status) && (
                  <Button variant="primary" size="sm" onClick={handleRetry}>
                    Retry
                  </Button>
                )}
                {!['completed', 'failed', 'expired'].includes(task.status) && (
                  <Button variant="danger" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Error</h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <div className="flex justify-center space-x-2">
              <Button variant="secondary" size="sm" onClick={fetchTask}>
                Retry
              </Button>
              <Link href="/dashboard/agent-tasks">
                <Button variant="ghost" size="sm">
                  Back to list
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Content */}
        {task && !error && <AgentTaskDetail task={task} />}
      </div>
    </DashboardLayout>
  );
}
