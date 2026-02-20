'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Input, Select } from '@/components/ui';
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
        setModel(data.model || 'claude-sonnet-4-20250514');
      } catch {
        showToast('error', 'Failed to load AI configuration');
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, [authLoading, showToast]);

  // Validate key
  const handleValidateKey = async () => {
    if (!apiKey.trim()) return;

    setKeyStatus('testing');
    setKeyError(null);

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
    setSaving(true);

    try {
      const payload: { apiKey?: string; model?: string } = { model };
      if (apiKey.trim()) {
        payload.apiKey = apiKey;
      }

      const updated = await aiConfigApi.updateConfig(payload);
      setConfig(updated);
      setApiKey('');
      setKeyStatus('idle');
      setKeyError(null);
      showToast('success', 'AI configuration saved successfully');
    } catch (err: any) {
      showToast(
        'error',
        err.message || 'Failed to save AI configuration'
      );
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{toast.type === 'success' ? 'OK' : '!'}</span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
          </div>
        )}

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
            <div className="flex gap-3 pt-4 border-t">
              <Button type="submit" isLoading={saving}>
                {config?.configured ? 'Update Configuration' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
