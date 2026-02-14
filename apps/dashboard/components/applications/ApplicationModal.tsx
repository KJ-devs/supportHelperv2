/**
 * Application Modal Component
 * Modal pour créer ou éditer une application
 */

'use client';

import { useState, useEffect } from 'react';
import type { Application, CreateApplicationData } from '@/lib/types/application';
import { Modal, Button, Input, Select } from '@/components/ui';

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateApplicationData) => Promise<void>;
  application?: Application | null;
  isLoading?: boolean;
}

export function ApplicationModal({
  isOpen,
  onClose,
  onSubmit,
  application,
  isLoading = false,
}: ApplicationModalProps) {
  const [formData, setFormData] = useState<CreateApplicationData>({
    name: '',
    platform: 'web',
    settings: {
      recordVideo: true,
      captureLogs: true,
      autoAssign: false,
      notifyOnNewTicket: true,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load application data when editing
  useEffect(() => {
    if (application) {
      setFormData({
        name: application.name,
        platform: application.platform,
        settings: application.settings || {},
      });
    } else {
      // Reset form for new application
      setFormData({
        name: '',
        platform: 'web',
        settings: {
          recordVideo: true,
          captureLogs: true,
          autoAssign: false,
          notifyOnNewTicket: true,
        },
      });
    }
    setErrors({});
  }, [application, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.platform) {
      newErrors.platform = 'La plateforme est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleChange = (field: keyof CreateApplicationData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value,
      },
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={application ? 'Modifier l&apos;application' : 'Nouvelle application'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            {application ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <Input
          label="Nom de l&apos;application"
          placeholder="Mon Application"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          required
          disabled={isLoading}
        />

        {/* Platform */}
        <Select
          label="Plateforme"
          value={formData.platform}
          onChange={(e) => handleChange('platform', e.target.value)}
          error={errors.platform}
          required
          disabled={isLoading}
          options={[
            { value: 'web', label: '🌐 Web' },
            { value: 'mobile', label: '📱 Mobile' },
            { value: 'desktop', label: '💻 Desktop' },
            { value: 'other', label: '📦 Autre' },
          ]}
        />

        {/* Settings */}
        <div className="pt-4 border-t dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Paramètres du SDK
          </h3>

          <div className="space-y-3">
            {/* Record Video */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.recordVideo ?? true}
                onChange={(e) => handleSettingChange('recordVideo', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  🎥 Enregistrement vidéo
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Permettre l&apos;enregistrement de vidéos avec les tickets
                </div>
              </div>
            </label>

            {/* Capture Logs */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.captureLogs ?? true}
                onChange={(e) => handleSettingChange('captureLogs', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  📝 Capture des logs
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Capturer les logs console automatiquement
                </div>
              </div>
            </label>

            {/* Auto Assign */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.autoAssign ?? false}
                onChange={(e) => handleSettingChange('autoAssign', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  🤖 Attribution automatique
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Assigner automatiquement les nouveaux tickets
                </div>
              </div>
            </label>

            {/* Notify on New Ticket */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.notifyOnNewTicket ?? true}
                onChange={(e) => handleSettingChange('notifyOnNewTicket', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  🔔 Notifications
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Recevoir des notifications pour les nouveaux tickets
                </div>
              </div>
            </label>
          </div>
        </div>

        {application && (
          <div className="pt-4 border-t dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 La clé SDK ne peut pas être modifiée. Utilisez le bouton &quot;Régénérer&quot;
              sur la carte de l&apos;application pour créer une nouvelle clé.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
