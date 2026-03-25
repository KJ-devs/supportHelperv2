'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRequireAuth } from '@/lib/auth';
import { agentTasksApi } from '@/lib/api/agent-tasks';
import type { AgentTask, ExecutionLogEntry } from '@/lib/api/agent-tasks';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Button, ConfirmModal, useToast } from '@/components/ui';
import { AgentTaskStatusBadge } from '../components/AgentTaskStatusBadge';
import { AgentTaskDetail, isInProgress, isTerminal } from '../components/AgentTaskDetail';
import { useAgentTaskSocket } from '@/hooks/useAgentTaskSocket';
import type { ActionPlan } from '@/lib/api/agent-tasks';

const POLLING_INTERVAL_MS = 3000;

export default function AgentTaskDetailPage() {
  const params = useParams();
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('agentTaskDetail');

  const taskId = params.id as string;

  const toast = useToast();
  const [task, setTask] = useState<AgentTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectPhase, setRejectPhase] = useState<'plan' | 'code'>('plan');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchTask = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await agentTasksApi.getTask(taskId);
      setTask(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorTitle'));
      console.error('Error fetching agent task:', err);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, t]);

  // Silently refresh (no loading state) for polling / WS-triggered refetch
  const silentRefetch = useCallback(async () => {
    try {
      const data = await agentTasksApi.getTask(taskId);
      setTask(data);
    } catch (err: unknown) {
      console.error('Error silently refetching agent task:', err);
    }
  }, [taskId]);

  useEffect(() => {
    if (!authLoading && taskId) {
      fetchTask();
    }
  }, [taskId, authLoading, fetchTask]);

  // Polling fallback: active when task is in-progress, stopped when terminal
  const taskStatus = task?.status ?? null;
  useEffect(() => {
    if (!taskStatus) return;

    if (isInProgress(taskStatus)) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(silentRefetch, POLLING_INTERVAL_MS);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [taskStatus, silentRefetch]);

  // WebSocket handlers
  const handleStatusChange = useCallback(
    (_taskId: string, _newStatus: string) => {
      silentRefetch();
    },
    [silentRefetch]
  );

  const handleLogAppended = useCallback((entry: ExecutionLogEntry) => {
    setTask(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        executionLog: [...(prev.executionLog ?? []), entry],
      };
    });
  }, []);

  const handlePlanReady = useCallback((plan: unknown) => {
    setTask(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        actionPlan: plan as ActionPlan,
      };
    });
  }, []);

  const handleWsError = useCallback((errorMessage: string) => {
    console.error('[AgentTaskDetailPage] WS error:', errorMessage);
    setTask(prev => {
      if (!prev) return prev;
      return { ...prev, error: errorMessage };
    });
  }, []);

  const { isConnected } = useAgentTaskSocket(taskId ?? null, {
    onStatusChange: handleStatusChange,
    onLogAppended: handleLogAppended,
    onPlanReady: handlePlanReady,
    onError: handleWsError,
  });

  const isLive = isConnected || (task ? isInProgress(task.status) : false);

  const handleRetry = async () => {
    if (!task) return;
    try {
      const updated = await agentTasksApi.retryTask(task.id);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('alertRetryFailed'));
    }
  };

  const handleCancel = async () => {
    if (!task) return;
    if (!confirm(t('confirmCancel'))) return;
    try {
      const updated = await agentTasksApi.cancelTask(task.id);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('alertCancelFailed'));
    }
  };

  const handleApprove = async (phase: 'plan' | 'code') => {
    if (!task) return;
    try {
      const updated = await agentTasksApi.approveTask(task.id, phase);
      setTask(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('alertApproveFailed'));
    }
  };

  const openRejectModal = (phase: 'plan' | 'code') => {
    setRejectPhase(phase);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!task || !rejectReason.trim()) return;
    try {
      setIsRejecting(true);
      const updated = await agentTasksApi.rejectTask(task.id, rejectPhase, rejectReason);
      setTask(updated);
      toast.success(t('rejectSuccess'));
      setShowRejectModal(false);
      setRejectReason('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('alertRejectFailed'));
    } finally {
      setIsRejecting(false);
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
            &larr; {t('backToAgentTasks')}
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {t('pageTitle')}
              </h1>
              {task && <AgentTaskStatusBadge status={task.status} />}
              {!isConnected && task && !isTerminal(task.status) && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400"
                  title={t('offlineTooltip')}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {t('offline')}
                </span>
              )}
            </div>

            {task && (
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm" onClick={silentRefetch}>
                  {t('refresh')}
                </Button>
                {task.status === 'plan_pending_review' && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => handleApprove('plan')}>
                      {t('approvePlan')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => openRejectModal('plan')}>
                      {t('rejectPlan')}
                    </Button>
                  </>
                )}
                {task.status === 'code_pending_review' && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => handleApprove('code')}>
                      {t('approveCode')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => openRejectModal('code')}>
                      {t('rejectCode')}
                    </Button>
                  </>
                )}
                {['failed', 'expired'].includes(task.status) && (
                  <Button variant="primary" size="sm" onClick={handleRetry}>
                    {t('retry')}
                  </Button>
                )}
                {!isTerminal(task.status) && (
                  <Button variant="danger" size="sm" onClick={handleCancel}>
                    {t('cancel')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">
              {t('errorTitle')}
            </h3>
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <div className="flex justify-center space-x-2">
              <Button variant="secondary" size="sm" onClick={fetchTask}>
                {t('retry')}
              </Button>
              <Link href="/dashboard/agent-tasks">
                <Button variant="ghost" size="sm">
                  {t('backToList')}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Content */}
        {task && !error && <AgentTaskDetail task={task} isLive={isLive} />}
      </div>

      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
        onConfirm={handleRejectConfirm}
        title={t('rejectTitle')}
        message={
          <div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('rejectMessage')}</p>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder={t('rejectPlaceholder')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              autoFocus
            />
          </div>
        }
        confirmLabel={t('rejectConfirmLabel')}
        cancelLabel={t('rejectCancelLabel')}
        variant="danger"
        isLoading={isRejecting}
      />
    </DashboardLayout>
  );
}
