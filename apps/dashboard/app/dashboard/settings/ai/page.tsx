'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Input, Select, useToast } from '@/components/ui';
import { aiConfigApi, type AiConfigResponse } from '@/lib/api/ai-config';

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4 (Fast)' },
];

// Model options by provider
const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast)' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
  ],
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1 (Default)' },
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'codellama', label: 'CodeLlama' },
  ],
};

// Provider info
const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    description: 'Industry-leading models with exceptional reasoning capabilities',
    icon: '🧠',
    requiresApiKey: true,
    defaultEndpoint: 'https://api.openai.com/v1',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Claude models with advanced context understanding and safety',
    icon: '✨',
    requiresApiKey: true,
    defaultEndpoint: 'https://api.anthropic.com/v1',
  },
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run AI models locally on your own hardware for privacy',
    icon: 'Monitor',
    requiresApiKey: false,
    defaultEndpoint: 'http://localhost:11434',
  },
};

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function AiSettingsPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [config, setConfig] = useState<AiConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-20250514');

  // Validation state
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [keyError, setKeyError] = useState<string | null>(null);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Toast
  const toast = useToast();

  // Load config
  useEffect(() => {
    if (authLoading) return;

    const loadConfig = async () => {
      try {
        const data = await aiConfigApi.getConfig();
        setConfig(data);

        // Set form values from config
        const currentProvider = (data.provider || 'anthropic') as AIProviderType;
        setProvider(currentProvider);
        const defaultModel = MODEL_OPTIONS[currentProvider]?.[0]?.value || '';
        setModel(data.model || defaultModel);

        // Set endpoint for Ollama
        if (currentProvider === 'ollama' && data.settings?.endpoint) {
          setEndpoint(data.settings.endpoint);
        } else if (currentProvider === 'ollama') {
          setEndpoint(PROVIDER_INFO.ollama.defaultEndpoint);
        }

        // Set organization ID for OpenAI
        if (currentProvider === 'openai' && data.settings?.organizationId) {
          setOrganizationId(data.settings.organizationId);
        }
      } catch (err) {
        toast.error('AI Configuration', 'Failed to load AI configuration');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Update defaults when provider changes
  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    const defaultModel = MODEL_OPTIONS[newProvider]?.[0]?.value || '';
    setModel(defaultModel);
    setApiKey('');
    setShowApiKey(false);
    setTestStatus('idle');
    setTestMessage(null);
    setFieldErrors({});

    // Set default endpoint for Ollama
    if (newProvider === 'ollama') {
      setEndpoint(PROVIDER_INFO.ollama.defaultEndpoint);
    } else {
      setEndpoint('');
    }

    // Clear organization ID when not OpenAI
    if (newProvider !== 'openai') {
      setOrganizationId('');
    }
  };

  // Validate a single field and update errors state
  const validateEndpoint = (value: string): string => {
    if (!value.trim()) return 'L\'URL de l\'endpoint est requise';
    try {
      new URL(value);
      return '';
    } catch {
      return 'URL invalide (ex: http://localhost:11434)';
    }
  };

  const getFormErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (provider === 'ollama') {
      const endpointErr = validateEndpoint(endpoint);
      if (endpointErr) errors.endpoint = endpointErr;
    }
    const providerRequiresKey = PROVIDER_INFO[provider]?.requiresApiKey;
    const configured = config?.configured && config?.provider === provider;
    if (providerRequiresKey && !configured && !apiKey.trim()) {
      errors.apiKey = 'La clé API est requise';
    }
    return errors;
  };

  const isFormValid = Object.keys(getFormErrors()).length === 0;

  // Test connection
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(null);

    try {
      const result = await aiConfigApi.validateKey(apiKey);
      if (result.valid) {
        setKeyStatus('valid');
      } else {
        setKeyStatus('invalid');
        setKeyError(result.error || 'Invalid API key');
      }
    } catch {
      setKeyStatus('invalid');
      setKeyError('Failed to validate key');
    }
  };

  // Save config
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Run full validation before submit
    const formErrors = getFormErrors();
    if (Object.keys(formErrors).length > 0) {
      setFieldErrors(formErrors);
      return;
    }

    setSaving(true);

    try {
      const payload: { apiKey?: string; model?: string } = { model };
      if (apiKey.trim()) {
        payload.apiKey = apiKey;
      }

      const updated = await aiConfigApi.updateConfig(payload);
      setConfig(updated);
      setApiKey('');
      setShowApiKey(false);
      setTestStatus('idle');
      setTestMessage(null);
      setFieldErrors({});
      toast.success('AI Configuration', 'AI configuration saved successfully');
    } catch (err: any) {
      toast.error('AI Configuration', err.message || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <a
              href="/dashboard/settings"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Settings
            </a>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-900 font-medium">AI</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            AI Configuration
          </h1>
          <p className="text-gray-600 mt-1">
            Configure your Anthropic API key to enable AI-powered features like
            ticket analysis, agent conversations, and automated classification.
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  config?.configured ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-sm font-medium text-gray-900">
                {config?.configured
                  ? 'AI is configured and ready'
                  : 'AI is not configured'}
              </span>
            </div>
            {config?.configured && config.maskedApiKey && (
              <span className="text-sm text-gray-500 font-mono">
                Key: {config.maskedApiKey}
              </span>
            )}
          </div>

          {!config?.configured && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                Configure your Anthropic API key to enable the AI agent. You
                can obtain a key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  console.anthropic.com
                </a>
                .
              </p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyStatus('idle');
                      setKeyError(null);
                    }}
                    placeholder={
                      config?.configured
                        ? 'Enter new key to replace existing one'
                        : 'sk-ant-api03-...'
                    }
                    disabled={saving}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleValidateKey}
                  disabled={!apiKey.trim() || keyStatus === 'testing'}
                  isLoading={keyStatus === 'testing'}
                >
                  Validate
                </Button>
              </div>

              {/* Validation feedback */}
              {keyStatus === 'valid' && (
                <p className="mt-2 text-sm text-green-600 font-medium">
                  API key is valid
                </p>
              )}
              {keyStatus === 'invalid' && keyError && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {keyError}
                </p>
              )}
            </div>

            {/* API Key (if required) */}
            {currentProviderInfo.requiresApiKey && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                  {!isConfigured && <span className="text-red-500 ml-1" aria-label="requis">*</span>}
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setTestStatus('idle');
                        setTestMessage(null);
                        if (fieldErrors.apiKey) {
                          setFieldErrors((prev) => ({ ...prev, apiKey: '' }));
                        }
                      }}
                      onBlur={() => {
                        if (!isConfigured && !apiKey.trim()) {
                          setFieldErrors((prev) => ({ ...prev, apiKey: 'La clé API est requise' }));
                        } else {
                          setFieldErrors((prev) => ({ ...prev, apiKey: '' }));
                        }
                      }}
                      error={fieldErrors.apiKey}
                      placeholder={
                        isConfigured
                          ? 'Enter new key to replace existing one'
                          : provider === 'openai'
                          ? 'sk-proj-...'
                          : 'sk-ant-api03-...'
                      }
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showApiKey ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {provider === 'openai' && (
                    <>
                      Get your API key from{' '}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        platform.openai.com
                      </a>
                    </>
                  )}
                  {provider === 'anthropic' && (
                    <>
                      Get your API key from{' '}
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        console.anthropic.com
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Endpoint (for Ollama) */}
            {provider === 'ollama' && (
              <Input
                label="Endpoint URL"
                type="url"
                value={endpoint}
                onChange={(e) => {
                  setEndpoint(e.target.value);
                  if (fieldErrors.endpoint) {
                    setFieldErrors((prev) => ({ ...prev, endpoint: '' }));
                  }
                }}
                onBlur={(e) => {
                  const err = validateEndpoint(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, endpoint: err }));
                }}
                error={fieldErrors.endpoint}
                placeholder="http://localhost:11434"
                helperText={fieldErrors.endpoint ? undefined : 'URL of your Ollama server'}
                disabled={saving}
                required
              />
            )}

            {/* Organization ID (for OpenAI) */}
            {provider === 'openai' && (
              <Input
                label="Organization ID (Optional)"
                type="text"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="org-..."
                helperText="Required only if you belong to multiple organizations"
                disabled={saving}
              />
            )}

            {/* Model Selector */}
            <Select
              label="Model"
              options={MODEL_OPTIONS}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={saving}
            />

            {/* Current config info */}
            {config?.configured && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Provider</span>
                  <span className="font-medium text-gray-900 capitalize">
                    {config.provider}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current Model</span>
                  <span className="font-medium text-gray-900">
                    {config.model}
                  </span>
                </div>
                {config.updatedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Updated</span>
                    <span className="font-medium text-gray-900">
                      {new Date(config.updatedAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="submit" isLoading={saving} disabled={saving || !isFormValid}>
                {isConfigured ? 'Update Configuration' : 'Save Configuration'}
              </Button>
              {!isConfigured && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setApiKey('');
                    setShowApiKey(false);
                    setTestStatus('idle');
                    setTestMessage(null);
                    setFieldErrors({});
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
