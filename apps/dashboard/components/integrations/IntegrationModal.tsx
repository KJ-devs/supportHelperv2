'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Integration,
  IntegrationType,
  CreateIntegrationData,
  ConfigField,
} from '@/lib/types/integration';
import { Modal, Button, Input, Select } from '@/components/ui';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIntegrationData) => Promise<void>;
  integration?: Integration | null;
  types: IntegrationType[];
  isLoading?: boolean;
}

export function IntegrationModal({
  isOpen,
  onClose,
  onSubmit,
  integration,
  types,
  isLoading,
}: IntegrationModalProps) {
  const t = useTranslations('integrationModal');
  const [formData, setFormData] = useState<CreateIntegrationData>({
    type: '',
    name: '',
    enabled: true,
    config: {},
    mappings: {},
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);

  useEffect(() => {
    if (integration) {
      setFormData({
        type: integration.type,
        name: integration.name,
        enabled: integration.enabled,
        config: integration.config,
        mappings: integration.mappings || {},
      });
      const type = types.find(t => t.type === integration.type);
      setSelectedType(type || null);
    } else {
      setFormData({
        type: '',
        name: '',
        enabled: true,
        config: {},
        mappings: {},
      });
      setSelectedType(null);
    }
    setErrors({});
  }, [integration, types, isOpen]);

  const handleTypeChange = (type: string) => {
    const selectedTypeObj = types.find(t => t.type === type);
    setSelectedType(selectedTypeObj || null);
    setFormData({
      ...formData,
      type,
      config: {},
    });
  };

  const handleConfigChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value,
      },
    });
    if (errors[key]) {
      setErrors({ ...errors, [key]: '' });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('nameRequired');
    }

    if (!formData.type) {
      newErrors.type = t('typeRequired');
    }

    if (selectedType) {
      selectedType.requiredConfig.forEach(field => {
        if (!formData.config[field.key] || formData.config[field.key] === '') {
          newErrors[field.key] = t('fieldRequired', { label: field.label });
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      setErrors({ submit: error.message });
    }
  };

  const renderConfigField = (field: ConfigField) => {
    const value = formData.config[field.key] || '';
    const error = errors[field.key];

    if (field.type === 'select' && field.options) {
      return (
        <Select
          key={field.key}
          label={field.label}
          value={value}
          onChange={e => handleConfigChange(field.key, e.target.value)}
          error={error}
          options={field.options}
          placeholder={t('selectFieldPlaceholder', { label: field.label })}
        />
      );
    }

    return (
      <Input
        key={field.key}
        label={field.label}
        type={field.type === 'password' ? 'password' : 'text'}
        value={value}
        onChange={e => handleConfigChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        error={error}
        helperText={field.description}
      />
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={integration ? t('titleEdit') : t('titleNew')}
      size="lg"
    >
      <div className="space-y-4">
        {/* Name */}
        <Input
          label={t('nameLabel')}
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('namePlaceholder')}
          error={errors.name}
        />

        {/* Type */}
        {!integration && (
          <Select
            label={t('typeLabel')}
            value={formData.type}
            onChange={e => handleTypeChange(e.target.value)}
            error={errors.type}
            options={types.map(type => ({
              value: type.type,
              label: `${type.name} - ${type.description}`,
            }))}
            placeholder={t('typePlaceholder')}
          />
        )}

        {/* Dynamic Config Fields */}
        {selectedType && (
          <div className="border-t dark:border-gray-700 pt-4 space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{t('configSection')}</h4>

            {selectedType.requiredConfig.map(renderConfigField)}

            {selectedType.optionalConfig.length > 0 && (
              <>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                  {t('optionalSettings')}
                </h5>
                {selectedType.optionalConfig.map(renderConfigField)}
              </>
            )}
          </div>
        )}

        {/* Enabled Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
          />
          <label
            htmlFor="enabled"
            className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100"
          >
            {t('enableLabel')}
          </label>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="text-sm text-red-600 dark:text-red-400">{errors.submit}</div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button onClick={handleSubmit} isLoading={isLoading}>
          {integration ? t('update') : t('create')}
        </Button>
      </div>
    </Modal>
  );
}
