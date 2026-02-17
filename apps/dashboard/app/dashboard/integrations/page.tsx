'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { integrationsApi } from '@/lib/api/integrations';
import type {
  Integration,
  IntegrationType,
  CreateIntegrationData,
} from '@/lib/types/integration';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { IntegrationModal } from '@/components/integrations/IntegrationModal';
import { SyncLogsPanel } from '@/components/integrations/SyncLogsPanel';
import { ToastProvider, useToast } from '@/components/integrations/IntegrationToast';
import { PageLoader, EmptyState } from '@/components/ui';

function IntegrationsPageContent() {
  const { addToast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [types, setTypes] = useState<IntegrationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [_testingId, setTestingId] = useState<string | null>(null);
  const [_syncingId, setSyncingId] = useState<string | null>(null);

  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [selectedIntegrationForLogs, setSelectedIntegrationForLogs] =
    useState<Integration | null>(null);

  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncTarget, setSyncTarget] = useState<Integration | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [enabledFilter, setEnabledFilter] = useState<string>('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [integrationsData, typesData] = await Promise.all([
        integrationsApi.getIntegrations(),
        integrationsApi.getTypes(),
      ]);
      setIntegrations(integrationsData);
      setTypes(typesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load integrations');
      console.error('Error fetching integrations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingIntegration(null);
    setIsModalOpen(true);
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: CreateIntegrationData) => {
    try {
      setIsSubmitting(true);

      if (editingIntegration) {
        await integrationsApi.updateIntegration(editingIntegration.id, data);
        addToast({
          type: 'success',
          title: 'Integration updated',
          message: `Successfully updated ${data.name}`,
        });
      } else {
        await integrationsApi.createIntegration(data);
        addToast({
          type: 'success',
          title: 'Integration created',
          message: `Successfully created ${data.name}`,
        });
      }

      await fetchData();
      setIsModalOpen(false);
      setEditingIntegration(null);
    } catch (error: any) {
      addToast({
        type: 'error',
        title: editingIntegration ? 'Update failed' : 'Creation failed',
        message: error.message,
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (integration: Integration) => {
    if (
      !confirm(
        `Are you sure you want to delete "${integration.name}"?\n\nThis will also delete all sync logs.`
      )
    ) {
      return;
    }

    try {
      await integrationsApi.deleteIntegration(integration.id);
      addToast({
        type: 'success',
        title: 'Integration deleted',
        message: `Successfully deleted ${integration.name}`,
      });
      await fetchData();
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Delete failed',
        message: error.message,
      });
    }
  };

  const handleTest = async (integration: Integration) => {
    setTestingId(integration.id);
    try {
      const result = await integrationsApi.testConnection(integration.id);
      if (result.success) {
        addToast({
          type: 'success',
          title: 'Connection successful',
          message: result.message || `Successfully connected to ${integration.name}`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Connection failed',
          message: result.error || 'Unknown error',
        });
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Connection test failed',
        message: error.message,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = (integration: Integration) => {
    setSyncTarget(integration);
    setIsSyncDialogOpen(true);
  };

  const executeSyncDirection = useCallback(
    async (direction: 'push' | 'pull' | 'both') => {
      if (!syncTarget) return;
      setIsSyncDialogOpen(false);
      setSyncingId(syncTarget.id);
      try {
        const result = await integrationsApi.syncTickets(syncTarget.id, { direction });
        const parts: string[] = [];
        if (result.pushed > 0) parts.push(`${result.pushed} pushed`);
        if (result.pulled > 0) parts.push(`${result.pulled} pull queued`);
        if (result.skipped > 0) parts.push(`${result.skipped} already synced`);
        if (parts.length === 0) parts.push('No new tickets to sync');
        addToast({
          type: 'success',
          title: `Sync queued (${direction})`,
          message: parts.join(', '),
        });
      } catch (error: any) {
        addToast({
          type: 'error',
          title: 'Sync failed',
          message: error.message,
        });
      } finally {
        setSyncingId(null);
        setSyncTarget(null);
      }
    },
    [syncTarget, addToast],
  );

  const handleViewLogs = (integration: Integration) => {
    setSelectedIntegrationForLogs(integration);
    setIsLogsOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    );
  }

  const getMostRecentSync = () => {
    const dates = integrations
      .map((i) => i.lastSyncedAt)
      .filter((d): d is string => !!d)
      .map((d) => new Date(d).getTime());
    if (dates.length === 0) return 'Never';
    const mostRecent = new Date(Math.max(...dates));
    const now = new Date();
    const seconds = Math.floor((now.getTime() - mostRecent.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filteredIntegrations = integrations.filter((integration) => {
    if (typeFilter && integration.type !== typeFilter) return false;
    if (enabledFilter && integration.enabled.toString() !== enabledFilter) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header - Gradient Hero */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Integrations</h1>
              <p className="mt-2 text-blue-100 max-w-lg">
                Connect Support Helper with your favorite tools. Push tickets out, pull them in, or sync both ways.
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg shadow-indigo-500/25"
            >
              + Add Integration
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-3 flex-shrink-0">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Something went wrong</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">{error}</p>
              </div>
              <button
                onClick={fetchData}
                className="ml-4 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && integrations.length === 0 && !error && (
          <EmptyState
            icon={
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            }
            title="No integrations yet"
            description="Connect to Slack, Discord, Notion, Jira or HubSpot to automatically sync your support tickets."
            actionLabel="Add Your First Integration"
            onAction={handleCreate}
            variant="bordered"
            size="lg"
          />
        )}

        {/* Integrations Content */}
        {integrations.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {/* Total */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{integrations.length}</p>
                  </div>
                </div>
              </div>

              {/* Active */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {integrations.filter((i) => i.enabled).length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Syncs */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Syncs</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {integrations.reduce((sum, i) => sum + (i._count?.syncLogs || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Last Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Activity</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{getMostRecentSync()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Bar - Pill Style */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Type Filter Chips */}
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1.5">
                {[{ value: '', label: 'All Types' }, ...types.map((t) => ({ value: t.type, label: t.name }))].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTypeFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      typeFilter === opt.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1.5">
                {[
                  { value: '', label: 'All Status' },
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEnabledFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      enabledFilter === opt.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            {filteredIntegrations.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No integrations match your filters"
                description="Try adjusting your filter settings to see more results."
                actionLabel="Clear filters"
                onAction={() => {
                  setTypeFilter('');
                  setEnabledFilter('');
                }}
                variant="bordered"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onTest={handleTest}
                    onSync={handleSync}
                    onViewLogs={handleViewLogs}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Modal */}
        <IntegrationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingIntegration(null);
          }}
          onSubmit={handleSubmit}
          integration={editingIntegration}
          types={types}
          isLoading={isSubmitting}
        />

        {/* Sync Logs Panel */}
        {selectedIntegrationForLogs && (
          <SyncLogsPanel
            isOpen={isLogsOpen}
            onClose={() => {
              setIsLogsOpen(false);
              setSelectedIntegrationForLogs(null);
            }}
            integrationId={selectedIntegrationForLogs.id}
            integrationName={selectedIntegrationForLogs.name}
          />
        )}

        {/* Sync Direction Dialog */}
        {isSyncDialogOpen && syncTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setIsSyncDialogOpen(false);
                setSyncTarget(null);
              }}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Sync with {syncTarget.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose sync direction</p>
              <div className="space-y-3">
                {/* Push */}
                <button
                  onClick={() => executeSyncDirection('push')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Push</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Send tickets to {syncTarget.name}</p>
                  </div>
                </button>

                {/* Pull */}
                <button
                  onClick={() => executeSyncDirection('pull')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/20 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Pull</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Import tickets from {syncTarget.name}</p>
                  </div>
                </button>

                {/* Both */}
                <button
                  onClick={() => executeSyncDirection('both')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Bidirectional</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Push and pull in both directions</p>
                  </div>
                </button>
              </div>
              <button
                onClick={() => {
                  setIsSyncDialogOpen(false);
                  setSyncTarget(null);
                }}
                className="mt-4 w-full py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function IntegrationsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <ToastProvider>
      <IntegrationsPageContent />
    </ToastProvider>
  );
}
