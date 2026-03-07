/**
 * Application Modal Component
 * Modal pour créer ou éditer une application
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Application, CreateApplicationData } from '@/lib/types/application';
import { Modal, Button, Input, Select } from '@/components/ui';
import { Video, FileText, Bot, Bell, Lightbulb } from 'lucide-react';

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
  const t = useTranslations('appModal');
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

  useEffect(() => {
    if (application) {
      setFormData({
        name: application.name,
        platform: application.platform,
        settings: application.settings || {},
      });
    } else {
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
      newErrors.name = t('nameRequired');
    }

    if (!formData.platform) {
      newErrors.platform = t('platformRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateField = (field: string, value: any): string => {
    if (field === 'name' && !String(value).trim()) {
      return t('nameRequired');
    }
    if (field === 'platform' && !value) {
      return t('platformRequired');
    }
    return '';
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
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBlur = (field: string, value: any) => {
    const errorMsg = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: errorMsg }));
  };

  const hasErrors = Object.values(errors).some(e => e !== '');

  const handleSettingChange = (key: string, value: any) => {
    setFormData(prev => ({
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
      title={application ? t('titleEdit') : t('titleNew')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading} disabled={isLoading || hasErrors}>
            {application ? t('save') : t('create')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <Input
          label={t('nameLabel')}
          placeholder={t('namePlaceholder')}
          value={formData.name}
          onChange={e => handleChange('name', e.target.value)}
          onBlur={e => handleBlur('name', e.target.value)}
          error={errors.name}
          required
          disabled={isLoading}
        />

        {/* Platform */}
        <Select
          label={t('platformLabel')}
          value={formData.platform}
          onChange={e => handleChange('platform', e.target.value)}
          onBlur={e => handleBlur('platform', e.target.value)}
          error={errors.platform}
          required
          disabled={isLoading}
          options={[
            { value: 'web', label: 'Web' },
            { value: 'mobile', label: 'Mobile' },
            { value: 'desktop', label: 'Desktop' },
            { value: 'other', label: t('other') },
          ]}
        />

        {/* Settings */}
        <div className="pt-4 border-t dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            {t('sdkSettings')}
          </h3>

          <div className="space-y-3">
            {/* Record Video */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.recordVideo ?? true}
                onChange={e => handleSettingChange('recordVideo', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Video className="w-4 h-4" aria-hidden="true" />
                  {t('recordVideo')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('recordVideoDesc')}
                </div>
              </div>
            </label>

            {/* Capture Logs */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.captureLogs ?? true}
                onChange={e => handleSettingChange('captureLogs', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  {t('captureLogs')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('captureLogsDesc')}
                </div>
              </div>
            </label>

            {/* Auto Assign */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.autoAssign ?? false}
                onChange={e => handleSettingChange('autoAssign', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Bot className="w-4 h-4" aria-hidden="true" />
                  {t('autoAssign')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('autoAssignDesc')}
                </div>
              </div>
            </label>

            {/* Notify on New Ticket */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.notifyOnNewTicket ?? true}
                onChange={e => handleSettingChange('notifyOnNewTicket', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Bell className="w-4 h-4" aria-hidden="true" />
                  {t('notifications')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('notificationsDesc')}
                </div>
              </div>
            </label>
          </div>
        </div>

        {application && (
          <div className="pt-4 border-t dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{t('sdkKeyNote')}</span>
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
