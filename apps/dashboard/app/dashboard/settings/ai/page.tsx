'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Input, Select } from '@/components/ui';
import { aiConfigApi, type AiConfigResponse } from '@/lib/api/ai-config';

// Provider types
type AIProviderType = 'openai' | 'anthropic' | 'ollama';

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
  const [provider, setProvider] = useState<AIProviderType>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  // Test connection state
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

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
        showToast('error', 'Failed to load AI configuration');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [authLoading, showToast]);

  // Update defaults when provider changes
  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    const defaultModel = MODEL_OPTIONS[newProvider]?.[0]?.value || '';
    setModel(defaultModel);
    setApiKey('');
    setShowApiKey(false);
    setTestStatus('idle');
    setTestMessage(null);

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

  // Test connection
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(null);

    try {
      const testPayload: any = {
        provider,
        model,
      };

      if (apiKey.trim()) {
        testPayload.apiKey = apiKey;
      }

      if (provider === 'ollama' && endpoint) {
        testPayload.endpoint = endpoint;
      }

      if (provider === 'openai' && organizationId) {
        testPayload.organizationId = organizationId;
      }

      // Use testConnection if new API endpoint exists, fallback to validateKey
      let result;
      try {
        result = await aiConfigApi.testConnection(testPayload);
      } catch (err: any) {
        // Fallback to legacy validateKey endpoint if testConnection not available
        if (err.statusCode === 404 && testPayload.apiKey) {
          result = await aiConfigApi.validateKey(testPayload.apiKey);
        } else {
          throw err;
        }
      }

      if (result.valid) {
        setTestStatus('success');
        setTestMessage('Connection successful! AI provider is responding correctly.');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Failed to test connection');
    }
  };

  // Save config
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: any = {
        provider,
        model,
      };

      // Add API key if provided
      if (apiKey.trim() && PROVIDER_INFO[provider].requiresApiKey) {
        payload.apiKey = apiKey;
      }

      // Add provider-specific settings
      const settings: any = {};

      if (provider === 'ollama' && endpoint) {
        settings.endpoint = endpoint;
      }

      if (provider === 'openai' && organizationId) {
        settings.organizationId = organizationId;
      }

      if (Object.keys(settings).length > 0) {
        payload.settings = settings;
      }

      const updated = await aiConfigApi.updateConfig(payload);
      setConfig(updated);
      setApiKey('');
      setShowApiKey(false);
      setTestStatus('idle');
      setTestMessage(null);
      showToast('success', 'AI configuration saved successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <PageLoader />;
  }

  const currentProviderInfo = PROVIDER_INFO[provider];
  const isConfigured = config?.configured && config?.provider === provider;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{toast.type === 'success' ? '✓' : '✕'}</span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <a
              href="/dashboard/settings"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Settings
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">AI</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            AI Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure your AI provider to enable intelligent features like ticket analysis,
            agent conversations, and automated classification.
          </p>
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Select AI Provider
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(PROVIDER_INFO) as AIProviderType[]).map((providerKey) => {
              const info = PROVIDER_INFO[providerKey];
              const isSelected = provider === providerKey;

              return (
                <button
                  key={providerKey}
                  type="button"
                  onClick={() => handleProviderChange(providerKey)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="text-3xl">{info.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {info.name}
                        </h3>
                        {isSelected && (
                          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {info.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Configuration Form */}
        <Card>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Status indicator */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isConfigured ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {isConfigured
                    ? `${currentProviderInfo.name} is configured and ready`
                    : `${currentProviderInfo.name} is not configured`}
                </span>
              </div>
              {isConfigured && config?.maskedApiKey && (
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  Key: {config.maskedApiKey}
                </span>
              )}
            </div>

            {/* API Key (if required) */}
            {currentProviderInfo.requiresApiKey && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
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
                      }}
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
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                helperText="URL of your Ollama server"
                disabled={saving}
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
              options={MODEL_OPTIONS[provider]}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={saving}
            />

            {/* Test Connection */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Test Connection
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTestConnection}
                  disabled={
                    testStatus === 'testing' ||
                    (currentProviderInfo.requiresApiKey && !apiKey.trim() && !isConfigured)
                  }
                  isLoading={testStatus === 'testing'}
                >
                  Test Connection
                </Button>
              </div>

              {/* Test feedback */}
              {testStatus === 'success' && testMessage && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                    ✓ {testMessage}
                  </p>
                </div>
              )}
              {testStatus === 'error' && testMessage && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                    ✕ {testMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Current config info */}
            {isConfigured && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Provider</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {currentProviderInfo.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Current Model</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {config.model}
                  </span>
                </div>
                {config.updatedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {new Date(config.updatedAt).toLocaleDateString('en-US', {
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
              <Button type="submit" isLoading={saving}>
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
