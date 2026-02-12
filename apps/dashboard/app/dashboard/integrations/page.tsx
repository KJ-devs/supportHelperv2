'use client';

import { useState, useEffect } from 'react';
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
import { PageLoader, Button, Card, Select } from '@/components/ui';

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

  const handleSync = async (integration: Integration) => {
    if (
      !confirm(
        `Sync all tickets to ${integration.name}?\n\nThis may take a while for large ticket databases.`
      )
    ) {
      return;
    }

    setSyncingId(integration.id);
    try {
      const result = await integrationsApi.syncTickets(integration.id);
      addToast({
        type: 'success',
        title: 'Sync queued',
        message: `Queued ${result.queued} tickets for sync`,
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Sync failed',
        message: error.message,
      });
    } finally {
      setSyncingId(null);
    }
  };

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
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
              <p className="text-gray-600 mt-1">
                Connect your support tickets to external platforms
              </p>
            </div>
            <Button onClick={handleCreate}>Add Integration</Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-red-600 text-xl mr-3">⚠️</span>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchData}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && integrations.length === 0 && (
          <Card className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22v-5" />
              <path d="M9 8V2" />
              <path d="M15 8V2" />
              <path d="M18 8v5a6 6 0 0 1-12 0V8z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations yet</h3>
            <p className="text-gray-600 mb-6">
              Connect to Slack, Discord, Notion, and more to automatically sync your tickets.
            </p>
            <Button onClick={handleCreate}>Add Your First Integration</Button>
          </Card>
        )}

        {/* Integrations Grid */}
        {integrations.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Total Integrations</p>
                <p className="text-2xl font-bold text-gray-900">{integrations.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {integrations.filter((i) => i.enabled).length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Total Syncs</p>
                <p className="text-2xl font-bold text-blue-600">
                  {integrations.reduce((sum, i) => sum + (i._count?.syncLogs || 0), 0)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Last Activity</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{getMostRecentSync()}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Types' },
                  ...types.map((t) => ({ value: t.type, label: t.name })),
                ]}
                placeholder="Filter by type"
              />
              <Select
                value={enabledFilter}
                onChange={(e) => setEnabledFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ]}
                placeholder="Filter by status"
              />
            </div>

            {/* Grid */}
            {filteredIntegrations.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-600">No integrations match your filters</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setTypeFilter('');
                    setEnabledFilter('');
                  }}
                >
                  Clear filters
                </Button>
              </Card>
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
