'use client';

import { useState, useEffect } from 'react';
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
      const type = types.find((t) => t.type === integration.type);
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
    const selectedTypeObj = types.find((t) => t.type === type);
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
      newErrors.name = 'Name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Type is required';
    }

    if (selectedType) {
      selectedType.requiredConfig.forEach((field) => {
        if (!formData.config[field.key] || formData.config[field.key] === '') {
          newErrors[field.key] = `${field.label} is required`;
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
          onChange={(e) => handleConfigChange(field.key, e.target.value)}
          error={error}
          options={field.options}
          placeholder={`Select ${field.label}`}
        />
      );
    }

    return (
      <Input
        key={field.key}
        label={field.label}
        type={field.type === 'password' ? 'password' : 'text'}
        value={value}
        onChange={(e) => handleConfigChange(field.key, e.target.value)}
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
      title={integration ? 'Edit Integration' : 'New Integration'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Name */}
        <Input
          label="Integration Name"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          placeholder="My Slack Integration"
          error={errors.name}
        />

        {/* Type */}
        {!integration && (
          <Select
            label="Integration Type"
            value={formData.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            error={errors.type}
            options={types.map((type) => ({
              value: type.type,
              label: `${type.name} - ${type.description}`,
            }))}
            placeholder="Select type"
          />
        )}

        {/* Dynamic Config Fields */}
        {selectedType && (
          <div className="border-t dark:border-gray-700 pt-4 space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Configuration</h4>

            {selectedType.requiredConfig.map(renderConfigField)}

            {selectedType.optionalConfig.length > 0 && (
              <>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                  Optional Settings
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
            onChange={(e) =>
              setFormData({ ...formData, enabled: e.target.checked })
            }
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
          />
          <label
            htmlFor="enabled"
            className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100"
          >
            Enable this integration
          </label>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="text-sm text-red-600 dark:text-red-400">{errors.submit}</div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={isLoading}>
          {integration ? 'Update' : 'Create'} Integration
        </Button>
      </div>
    </Modal>
  );
}
