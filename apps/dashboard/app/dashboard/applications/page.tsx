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
import { PageLoader, Button, EmptyState, ConfirmModal, useToast } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';

export default function ApplicationsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const toast = useToast();

  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm modals state
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; app: Application | null }>({
    isOpen: false,
    app: null,
  });
  const [regenConfirm, setRegenConfirm] = useState<{ isOpen: boolean; app: Application | null }>({
    isOpen: false,
    app: null,
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

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
      toast.error('Erreur lors de la sauvegarde', error.message);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (app: Application) => {
    setDeleteConfirm({ isOpen: true, app });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.app) return;
    try {
      setIsActionLoading(true);
      await applicationsApi.deleteApplication(deleteConfirm.app.id);
      await fetchApplications();
      setDeleteConfirm({ isOpen: false, app: null });
    } catch (error: any) {
      toast.error('Erreur lors de la suppression', error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRegenerateKey = (app: Application) => {
    setRegenConfirm({ isOpen: true, app });
  };

  const handleRegenerateKeyConfirm = async () => {
    if (!regenConfirm.app) return;
    try {
      setIsActionLoading(true);
      await applicationsApi.regenerateKey(regenConfirm.app.id);
      await fetchApplications();
      setRegenConfirm({ isOpen: false, app: null });
      toast.success('Clé SDK régénérée avec succès');
    } catch (error: any) {
      toast.error('Erreur lors de la régénération', error.message);
    } finally {
      setIsActionLoading(false);
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Applications</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
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
          <EmptyState
            icon="📱"
            title="Aucune application"
            description="Créez votre première application pour commencer à recevoir des tickets."
            actionLabel="Créer une application"
            onAction={handleCreate}
            variant="bordered"
          />
        )}

        {/* Applications Grid */}
        {applications.length > 0 && (
          <>
            {/* Stats */}
            <div className="mb-6 bg-white dark:bg-gray-900 p-4 rounded-lg shadow dark:shadow-gray-800/20">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {applications.length}
                  </span>{' '}
                  application(s) active(s)
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total tickets:{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
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

        {/* Delete confirmation */}
        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, app: null })}
          onConfirm={handleDeleteConfirm}
          title="Supprimer l'application"
          message={`Êtes-vous sûr de vouloir supprimer "${deleteConfirm.app?.name}" ?\n\nCette action est irréversible et supprimera tous les tickets associés.`}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          variant="danger"
          isLoading={isActionLoading}
        />

        {/* Regenerate SDK key confirmation */}
        <ConfirmModal
          isOpen={regenConfirm.isOpen}
          onClose={() => setRegenConfirm({ isOpen: false, app: null })}
          onConfirm={handleRegenerateKeyConfirm}
          title="Régénérer la clé SDK"
          message={`Régénérer la clé SDK pour "${regenConfirm.app?.name}" ?\n\nL'ancienne clé ne fonctionnera plus. Vous devrez mettre à jour votre application.`}
          confirmLabel="Régénérer"
          cancelLabel="Annuler"
          variant="danger"
          isLoading={isActionLoading}
        />
      </div>
    </DashboardLayout>
  );
}
