'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Input, Select, Badge, useToast } from '@/components/ui';
import { aiConfigApi, type AiConfigResponse } from '@/lib/api/ai-config';
import type { AIProviderType } from '@/lib/types/ai-config';

// ---------------------------------------------------------------------------
// Static configuration data
// ---------------------------------------------------------------------------

const PROVIDER_INFO: Record<
  AIProviderType,
  {
    name: string;
    description: string;
    requiresApiKey: boolean;
    keyPlaceholder: string;
    keyHint: string | null;
    keyLink: string | null;
    keyLinkLabel: string | null;
    defaultEndpoint: string | null;
  }
> = {
  anthropic: {
    name: 'Anthropic',
    description: 'Claude models with advanced context understanding and safety',
    requiresApiKey: true,
    keyPlaceholder: 'sk-ant-api03-...',
    keyHint: 'Get your API key from',
    keyLink: 'https://console.anthropic.com/settings/keys',
    keyLinkLabel: 'console.anthropic.com',
    defaultEndpoint: null,
  },
  openai: {
    name: 'OpenAI',
    description: 'Industry-leading GPT models with exceptional reasoning capabilities',
    requiresApiKey: true,
    keyPlaceholder: 'sk-proj-...',
    keyHint: 'Get your API key from',
    keyLink: 'https://platform.openai.com/api-keys',
    keyLinkLabel: 'platform.openai.com',
    defaultEndpoint: null,
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Google DeepMind multimodal models with strong reasoning and long context',
    requiresApiKey: true,
    keyPlaceholder: 'AIza...',
    keyHint: 'Get your API key from',
    keyLink: 'https://aistudio.google.com/app/apikey',
    keyLinkLabel: 'aistudio.google.com',
    defaultEndpoint: null,
  },
  bedrock: {
    name: 'AWS Bedrock',
    description: 'Claude models via AWS Bedrock using IAM credentials — no API key required',
    requiresApiKey: false,
    keyPlaceholder: '',
    keyHint: null,
    keyLink: null,
    keyLinkLabel: null,
    defaultEndpoint: null,
  },
  ollama: {
    name: 'Ollama (Local)',
    description: 'Run open-source models locally on your own hardware for full privacy',
    requiresApiKey: false,
    keyPlaceholder: '',
    keyHint: null,
    keyLink: null,
    keyLinkLabel: null,
    defaultEndpoint: 'http://localhost:11434',
  },
};

const PROVIDER_ORDER: AIProviderType[] = ['anthropic', 'openai', 'gemini', 'bedrock', 'ollama'];

const MODEL_OPTIONS: Record<AIProviderType, Array<{ value: string; label: string }> | null> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (Fast)' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
    { value: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
  ],
  bedrock: [
    { value: 'anthropic.claude-sonnet-4-6-v1:0', label: 'Claude Sonnet 4.6 (Recommended)' },
    { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 (Fast)' },
  ],
  // null means free-text input
  ollama: null,
};

const BEDROCK_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

// ---------------------------------------------------------------------------
// Provider icon SVG components
// ---------------------------------------------------------------------------

function ProviderIcon({ provider, className }: { provider: AIProviderType; className?: string }) {
  const cls = className ?? 'w-6 h-6';
  switch (provider) {
    case 'anthropic':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-3.654 0h-3.6L0 20.48h3.603l1.357-3.504h7.08l1.357 3.504h3.603L10.173 3.52zm-4.17 10.44 2.389-6.17 2.39 6.17H5.999z" />
        </svg>
      );
    case 'openai':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.032.065L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.843-3.372L15.115 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.403-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
      );
    case 'gemini':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.885 13.24c-1.29 3.225-4.41 5.51-8.065 5.51-4.8 0-8.69-3.89-8.69-8.69 0-4.8 3.89-8.69 8.69-8.69 2.395 0 4.565.97 6.14 2.545l-1.45 1.45C13.12 3.67 11.62 3.07 10 3.07c-3.83 0-6.93 3.1-6.93 6.93s3.1 6.93 6.93 6.93c3.15 0 5.815-2.1 6.65-4.97H10v-2h8v1.02c0 .085-.005.168-.01.25l-.005.01h.005c-.03.685-.105 1.355-.25 2z" />
        </svg>
      );
    case 'bedrock':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.527.099C6.955-.744.942 3.9.099 10.473c-.843 6.572 3.8 12.584 10.373 13.428 6.573.843 12.587-3.801 13.428-10.374C24.744 6.955 20.101.943 13.527.099zm2.471 7.485a.855.855 0 0 1 .593.593l.012.045v4.58a.856.856 0 0 1-.711.844l-.05.006h-4.579a.857.857 0 0 1-.857-.857c0-.44.332-.803.759-.85l.098-.006h3.487V7.583c0-.44.333-.803.76-.85l.098-.006a.856.856 0 0 1 .39.057z" />
        </svg>
      );
    case 'ollama':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

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
  const [ollamaModel, setOllamaModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1');

  // Test connection state
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const toast = useToast();

  // ---------------------------------------------------------------------------
  // Load config on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (authLoading) return;

    const loadConfig = async () => {
      try {
        const data = await aiConfigApi.getConfig();
        setConfig(data);

        const currentProvider = (data.provider || 'anthropic') as AIProviderType;
        setProvider(currentProvider);

        const modelOptions = MODEL_OPTIONS[currentProvider];
        if (modelOptions) {
          setModel(data.model || modelOptions[0]?.value || '');
        } else {
          // Ollama free text
          setOllamaModel(data.model || 'llama3.1');
        }

        if (currentProvider === 'ollama') {
          setEndpoint(
            data.endpoint || data.settings?.endpoint || PROVIDER_INFO.ollama.defaultEndpoint || ''
          );
        }

        if (currentProvider === 'bedrock') {
          setBedrockRegion(
            (data.endpoint as string) || (data.settings?.region as string) || 'us-east-1'
          );
        }
      } catch {
        toast.error('AI Configuration', 'Failed to load AI configuration');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // ---------------------------------------------------------------------------
  // Provider change handler
  // ---------------------------------------------------------------------------

  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    const modelOptions = MODEL_OPTIONS[newProvider];
    if (modelOptions) {
      setModel(modelOptions[0]?.value || '');
    } else {
      setOllamaModel('llama3.1');
    }
    setApiKey('');
    setShowApiKey(false);
    setTestStatus('idle');
    setTestMessage(null);
    setFieldErrors({});

    if (newProvider === 'ollama') {
      setEndpoint(PROVIDER_INFO.ollama.defaultEndpoint || 'http://localhost:11434');
    } else {
      setEndpoint('');
    }
  };

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validateEndpoint = (value: string): string => {
    if (!value.trim()) return 'Endpoint URL is required';
    try {
      new URL(value);
      return '';
    } catch {
      return 'Invalid URL (e.g. http://localhost:11434)';
    }
  };

  const getFormErrors = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const info = PROVIDER_INFO[provider];
    const isConfigured = config?.configured && config?.provider === provider;

    if (provider === 'ollama') {
      const endpointErr = validateEndpoint(endpoint);
      if (endpointErr) errors.endpoint = endpointErr;
      if (!ollamaModel.trim()) errors.model = 'Model name is required';
    }

    if (info.requiresApiKey && !isConfigured && !apiKey.trim()) {
      errors.apiKey = 'API key is required';
    }

    return errors;
  };

  const isFormValid = Object.keys(getFormErrors()).length === 0;

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(null);

    try {
      const effectiveModel = MODEL_OPTIONS[provider] ? model : ollamaModel;
      const payload: Record<string, string> = {
        provider,
        model: effectiveModel,
      };

      if (apiKey.trim()) payload.apiKey = apiKey;

      if (provider === 'ollama') {
        payload.endpoint = endpoint;
      } else if (provider === 'bedrock') {
        payload.endpoint = bedrockRegion;
      }

      const result = await aiConfigApi.testConnection(payload as any);

      if (result.valid) {
        setTestStatus('success');
        setTestMessage('Connection successful — the AI provider is responding correctly.');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Failed to test connection');
    }
  };

  // ---------------------------------------------------------------------------
  // Save config
  // ---------------------------------------------------------------------------

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const formErrors = getFormErrors();
    if (Object.keys(formErrors).length > 0) {
      setFieldErrors(formErrors);
      return;
    }

    setSaving(true);

    try {
      const effectiveModel = MODEL_OPTIONS[provider] ? model : ollamaModel;
      const payload: Record<string, any> = {
        provider,
        model: effectiveModel,
      };

      const info = PROVIDER_INFO[provider];
      if (apiKey.trim() && info.requiresApiKey) {
        payload.apiKey = apiKey;
      }

      if (provider === 'ollama') {
        payload.endpoint = endpoint;
      } else if (provider === 'bedrock') {
        // Store region as endpoint (backend uses endpoint field for Bedrock region)
        payload.endpoint = bedrockRegion;
      }

      const updated = await aiConfigApi.updateConfig(payload);
      setConfig(updated);
      setApiKey('');
      setShowApiKey(false);
      setTestStatus('idle');
      setTestMessage(null);
      setFieldErrors({});
      toast.success('AI Configuration', 'Configuration saved successfully');
    } catch (err: any) {
      toast.error('AI Configuration', err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isConfigured = config?.configured === true;
  const isCurrentProviderConfigured = isConfigured && config?.provider === provider;
  const info = PROVIDER_INFO[provider];
  const modelOptions = MODEL_OPTIONS[provider];

  if (authLoading || loading) {
    return <PageLoader />;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-2 text-sm">
            <a
              href="/dashboard/settings"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Settings
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-900 dark:text-white font-medium">AI Configuration</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Configuration</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Bring your own API key (BYOK) to power ticket analysis, agent conversations, and
            automated classification.
          </p>
        </div>

        {/* Status banner */}
        <div className="mb-6">
          {isConfigured ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                    Connected — {PROVIDER_INFO[config.provider as AIProviderType]?.name ?? config.provider}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    Model: <span className="font-mono">{config.model}</span>
                    {config.maskedApiKey && (
                      <span className="ml-3">
                        Key: <span className="font-mono">{config.maskedApiKey}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Using platform default
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Configure your own API key below to use your preferred provider and model.
                  </p>
                </div>
              </div>
              <Badge variant="default">Not configured</Badge>
            </div>
          )}
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            Select Provider
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROVIDER_ORDER.map((providerKey) => {
              const pInfo = PROVIDER_INFO[providerKey];
              const isSelected = provider === providerKey;

              return (
                <button
                  key={providerKey}
                  type="button"
                  onClick={() => handleProviderChange(providerKey)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 mt-0.5 ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <ProviderIcon provider={providerKey} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isSelected
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {pInfo.name}
                        </span>
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-blue-500 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {pInfo.description}
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
            {/* Current provider status */}
            <div className="flex items-center justify-between pb-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={provider} className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-white">{info.name}</span>
              </div>
              <div>
                {isCurrentProviderConfigured ? (
                  <Badge variant="success">Configured</Badge>
                ) : (
                  <Badge variant="default">Not configured</Badge>
                )}
              </div>
            </div>

            {/* API Key field */}
            {info.requiresApiKey && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  API Key
                  {!isCurrentProviderConfigured && (
                    <span className="text-red-500 ml-1" aria-label="required">*</span>
                  )}
                </label>
                <div className="relative">
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
                      if (!isCurrentProviderConfigured && !apiKey.trim()) {
                        setFieldErrors((prev) => ({ ...prev, apiKey: 'API key is required' }));
                      } else {
                        setFieldErrors((prev) => ({ ...prev, apiKey: '' }));
                      }
                    }}
                    error={fieldErrors.apiKey}
                    placeholder={
                      isCurrentProviderConfigured
                        ? 'Enter a new key to replace the existing one'
                        : info.keyPlaceholder
                    }
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {isCurrentProviderConfigured && config?.maskedApiKey && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Current key: <span className="font-mono">{config.maskedApiKey}</span>
                  </p>
                )}
                {info.keyHint && info.keyLink && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {info.keyHint}{' '}
                    <a
                      href={info.keyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {info.keyLinkLabel}
                    </a>
                  </p>
                )}
              </div>
            )}

            {/* Model selection */}
            <div>
              {modelOptions ? (
                <Select
                  label="Model"
                  options={modelOptions}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={saving}
                />
              ) : (
                <Input
                  label="Model"
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => {
                    setOllamaModel(e.target.value);
                    if (fieldErrors.model) {
                      setFieldErrors((prev) => ({ ...prev, model: '' }));
                    }
                  }}
                  error={fieldErrors.model}
                  placeholder="llama3.1"
                  helperText={fieldErrors.model ? undefined : 'Enter the name of the Ollama model (e.g. llama3.1, mistral, codellama)'}
                  disabled={saving}
                />
              )}
            </div>

            {/* Bedrock-specific: Region */}
            {provider === 'bedrock' && (
              <Select
                label="AWS Region"
                options={BEDROCK_REGIONS}
                value={bedrockRegion}
                onChange={(e) => setBedrockRegion(e.target.value)}
                disabled={saving}
              />
            )}

            {/* Ollama-specific: Endpoint URL */}
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
                helperText={
                  fieldErrors.endpoint ? undefined : 'URL of your local Ollama server'
                }
                disabled={saving}
                required
              />
            )}

            {/* Test Connection section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Test Connection
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Verify that the configuration can reach the AI provider
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={
                    testStatus === 'testing' ||
                    (info.requiresApiKey && !apiKey.trim() && !isCurrentProviderConfigured)
                  }
                  isLoading={testStatus === 'testing'}
                >
                  Test Connection
                </Button>
              </div>

              {testStatus === 'success' && testMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <svg
                    className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p className="text-sm text-green-800 dark:text-green-300">{testMessage}</p>
                </div>
              )}

              {testStatus === 'error' && testMessage && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <svg
                    className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <p className="text-sm text-red-800 dark:text-red-300">{testMessage}</p>
                </div>
              )}
            </div>

            {/* Current config summary (if configured) */}
            {isCurrentProviderConfigured && config && (
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Current Configuration
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Provider</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {PROVIDER_INFO[config.provider as AIProviderType]?.name ?? config.provider}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Model</span>
                  <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
                    {config.model}
                  </span>
                </div>
                {config.maskedApiKey && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">API Key</span>
                    <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
                      {config.maskedApiKey}
                    </span>
                  </div>
                )}
                {provider === 'bedrock' && bedrockRegion && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">AWS Region</span>
                    <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
                      {bedrockRegion}
                    </span>
                  </div>
                )}
                {provider === 'ollama' && endpoint && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Endpoint</span>
                    <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">
                      {endpoint}
                    </span>
                  </div>
                )}
                {config.updatedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Last Updated</span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(config.updatedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Form actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="submit"
                isLoading={saving}
                disabled={saving || !isFormValid}
              >
                {isCurrentProviderConfigured ? 'Update Configuration' : 'Save Configuration'}
              </Button>
              {!isCurrentProviderConfigured && (
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
                  disabled={saving}
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
