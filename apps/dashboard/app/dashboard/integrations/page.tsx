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
import { PageLoader, Button, Card } from '@/components/ui';

export default function IntegrationsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [types, setTypes] = useState<IntegrationType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] =
    useState<Integration | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [_testingId, setTestingId] = useState<string | null>(null);
  const [_syncingId, setSyncingId] = useState<string | null>(null);

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
    if (!authLoading) {
      fetchData();
    }
  }, [authLoading]);

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
      } else {
        await integrationsApi.createIntegration(data);
      }

      await fetchData();
      setIsModalOpen(false);
      setEditingIntegration(null);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
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
      await fetchData();
    } catch (error: any) {
      alert(`Error deleting integration: ${error.message}`);
    }
  };

  const handleTest = async (integration: Integration) => {
    setTestingId(integration.id);
    try {
      const result = await integrationsApi.testConnection(integration.id);
      if (result.success) {
        alert(`✅ Connection successful!\n\n${result.message || ''}`);
      } else {
        alert(`❌ Connection failed!\n\n${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Connection test failed!\n\n${error.message}`);
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
      alert(`✅ Queued ${result.queued} tickets for sync!`);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleViewLogs = async (integration: Integration) => {
    alert(
      `Sync logs feature coming soon!\n\nIntegration: ${integration.name}\nTotal syncs: ${integration._count?.syncLogs || 0}`
    );
  };

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Integrations
              </h1>
              <p className="text-gray-600 mt-1">
                Connect your support tickets to external platforms
              </p>
            </div>
            <Button onClick={handleCreate}>🔌 Add Integration</Button>
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
            <div className="text-6xl mb-4">🔌</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No integrations yet
            </h3>
            <p className="text-gray-600 mb-6">
              Connect to Slack, Discord, Notion, and more to automatically sync
              your tickets.
            </p>
            <Button onClick={handleCreate}>🔌 Add Your First Integration</Button>
          </Card>
        )}

        {/* Integrations Grid */}
        {integrations.length > 0 && (
          <>
            {/* Stats */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">
                    {integrations.length}
                  </span>{' '}
                  integration(s) configured
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">
                    {integrations.filter((i) => i.enabled).length}
                  </span>{' '}
                  enabled
                </div>
                <div className="text-sm text-gray-600">
                  Total syncs:{' '}
                  <span className="font-medium text-gray-900">
                    {integrations.reduce(
                      (sum, i) => sum + (i._count?.syncLogs || 0),
                      0
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.map((integration) => (
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
      </div>
    </DashboardLayout>
  );
}
