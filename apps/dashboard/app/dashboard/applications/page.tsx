/**
 * Applications Page
 * Page de gestion des applications et SDK keys
 */

'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { applicationsApi } from '@/lib/api/applications';
import type { Application, CreateApplicationData } from '@/lib/types/application';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ApplicationCard } from '@/components/applications/ApplicationCard';
import { ApplicationModal } from '@/components/applications/ApplicationModal';
import { PageLoader, Button, Card } from '@/components/ui';
import { AlertTriangle, AppWindow, Plus } from 'lucide-react';

export default function ApplicationsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch applications
  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await applicationsApi.getApplications();
      setApplications(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des applications');
      console.error('Error fetching applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchApplications();
    }
  }, [authLoading]);

  const handleCreate = () => {
    setEditingApp(null);
    setIsModalOpen(true);
  };

  const handleEdit = (app: Application) => {
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: CreateApplicationData) => {
    try {
      setIsSubmitting(true);

      if (editingApp) {
        await applicationsApi.updateApplication(editingApp.id, data);
      } else {
        await applicationsApi.createApplication(data);
      }

      await fetchApplications();
      setIsModalOpen(false);
      setEditingApp(null);
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (app: Application) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer "${app.name}" ?\n\nCette action est irréversible et supprimera tous les tickets associés.`
      )
    ) {
      return;
    }

    try {
      await applicationsApi.deleteApplication(app.id);
      await fetchApplications();
    } catch (error: any) {
      alert(`Erreur lors de la suppression: ${error.message}`);
    }
  };

  const handleRegenerateKey = async (app: Application) => {
    if (
      !confirm(
        `Régénérer la clé SDK pour "${app.name}" ?\n\nL'ancienne clé ne fonctionnera plus. Vous devrez mettre à jour votre application.`
      )
    ) {
      return;
    }

    try {
      await applicationsApi.regenerateKey(app.id);
      await fetchApplications();
      alert('Clé SDK régénérée avec succès !');
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    }
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
              <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
              <p className="text-gray-600 mt-1">
                Gérez vos applications et leurs clés SDK
              </p>
            </div>
            <Button onClick={handleCreate}>
              ➕ Nouvelle application
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Erreur</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchApplications}
                className="ml-auto"
              >
                Réessayer
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && applications.length === 0 && (
          <Card className="text-center py-12">
            <AppWindow className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucune application
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Créez votre première application pour commencer à recevoir des tickets.
            </p>
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Créer une application
            </Button>
          </Card>
        )}

        {/* Applications Grid */}
        {applications.length > 0 && (
          <>
            {/* Stats */}
            <div className="mb-6 bg-white p-4 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">
                    {applications.length}
                  </span>{' '}
                  application(s) active(s)
                </div>
                <div className="text-sm text-gray-600">
                  Total tickets:{' '}
                  <span className="font-medium text-gray-900">
                    {applications.reduce((sum, app) => sum + (app._count?.tickets || 0), 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {applications.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRegenerateKey={handleRegenerateKey}
                />
              ))}
            </div>
          </>
        )}

        {/* Modal */}
        <ApplicationModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingApp(null);
          }}
          onSubmit={handleSubmit}
          application={editingApp}
          isLoading={isSubmitting}
        />
      </div>
    </DashboardLayout>
  );
}
