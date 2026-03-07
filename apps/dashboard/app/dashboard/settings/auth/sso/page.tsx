'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Input, Badge } from '@/components/ui';
import { ssoApi } from '@/lib/api/sso';
import type { SsoConfigResponse, SsoProviderType, RoleMapping } from '@/lib/types/sso';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function SsoSettingsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('settingsSso');

  // State
  const [config, setConfig] = useState<SsoConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Provider selection
  const [providerType, setProviderType] = useState<SsoProviderType>('saml');

  // SAML form fields
  const [entityId, setEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');

  // OIDC form fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [issuerUrl, setIssuerUrl] = useState('');

  // Common settings
  const [enabled, setEnabled] = useState(false);
  const [autoProvision, setAutoProvision] = useState(true);
  const [disablePassword, setDisablePassword] = useState(false);
  const [roleMappings, setRoleMappings] = useState<RoleMapping[]>([]);

  // Test connection
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Check if enterprise plan (mock - replace with actual check)
  const isEnterprise = true; // TODO: Replace with actual tenant plan check

  // Computed values
  const acsUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}/api/auth/saml/callback`;
  }, []);

  const redirectUri = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}/api/auth/oidc/callback`;
  }, []);

  const discoveryUrl = useMemo(() => {
    if (!issuerUrl) return '';
    try {
      const url = new URL(issuerUrl);
      return `${url.origin}${url.pathname}/.well-known/openid-configuration`;
    } catch {
      return '';
    }
  }, [issuerUrl]);

  // Load config
  useEffect(() => {
    if (authLoading) return;

    const loadConfig = async () => {
      try {
        const data = await ssoApi.getConfig();
        setConfig(data);

        setProviderType(data.providerType || 'saml');
        setEnabled(data.enabled || false);
        setAutoProvision(data.autoProvision ?? true);
        setDisablePassword(data.disablePassword || false);

        if (data.entityId) setEntityId(data.entityId);
        if (data.ssoUrl) setSsoUrl(data.ssoUrl);
        if (data.clientId) setClientId(data.clientId);
        if (data.issuerUrl) setIssuerUrl(data.issuerUrl);

        if (data.roleMapping && Object.keys(data.roleMapping).length > 0) {
          const mappings: RoleMapping[] = Object.entries(data.roleMapping).map(
            ([idpGroup, appRole], index) => ({
              id: `${index}`,
              idpGroup,
              appRole: appRole as 'admin' | 'member' | 'viewer',
            })
          );
          setRoleMappings(mappings);
        }
      } catch (err: any) {
        if (err.statusCode !== 404) {
          showToast('error', t('loadError'));
        }
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [authLoading, showToast, t]);

  const handleProviderChange = (newProvider: SsoProviderType) => {
    setProviderType(newProvider);
    setTestStatus('idle');
    setTestMessage(null);
  };

  const addRoleMapping = () => {
    const newMapping: RoleMapping = {
      id: Date.now().toString(),
      idpGroup: '',
      appRole: 'member',
    };
    setRoleMappings([...roleMappings, newMapping]);
  };

  const updateRoleMapping = (id: string, field: keyof RoleMapping, value: string) => {
    setRoleMappings(roleMappings.map(m => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const removeRoleMapping = (id: string) => {
    setRoleMappings(roleMappings.filter(m => m.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', t('copySuccess'));
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(null);

    try {
      const testPayload: any = { providerType };

      if (providerType === 'saml') {
        testPayload.entityId = entityId;
        testPayload.ssoUrl = ssoUrl;
        testPayload.certificate = certificate;
      } else {
        testPayload.clientId = clientId;
        testPayload.clientSecret = clientSecret;
        testPayload.issuerUrl = issuerUrl;
      }

      const result = await ssoApi.testConnection(testPayload);

      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message || 'Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(result.message || 'Connection failed');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || t('testError'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const roleMapping: Record<string, string> = {};
      roleMappings
        .filter(m => m.idpGroup.trim())
        .forEach(m => {
          roleMapping[m.idpGroup] = m.appRole;
        });

      const payload: any = {
        enabled,
        providerType,
        autoProvision,
        disablePassword,
        roleMapping,
      };

      if (providerType === 'saml') {
        payload.entityId = entityId;
        payload.ssoUrl = ssoUrl;
        if (certificate.trim()) payload.certificate = certificate;
      } else {
        payload.clientId = clientId;
        payload.issuerUrl = issuerUrl;
        if (clientSecret.trim()) payload.clientSecret = clientSecret;
      }

      const updated = await ssoApi.updateConfig(payload);
      setConfig(updated);
      setClientSecret('');
      setCertificate('');
      setShowClientSecret(false);
      setTestStatus('idle');
      setTestMessage(null);
      showToast('success', t('saveSuccess'));
    } catch (err: any) {
      showToast('error', err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('deleteConfirm'))) return;

    try {
      await ssoApi.deleteConfig();
      setConfig(null);
      setEnabled(false);
      setEntityId('');
      setSsoUrl('');
      setCertificate('');
      setClientId('');
      setClientSecret('');
      setIssuerUrl('');
      setRoleMappings([]);
      showToast('success', t('deleteSuccess'));
    } catch (err: any) {
      showToast('error', err.message || t('deleteError'));
    }
  };

  if (authLoading || loading) {
    return <PageLoader />;
  }

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
              {t('breadcrumbSettings')}
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">
              {t('breadcrumbSso')}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>

        {/* Enterprise gate */}
        {!isEnterprise && (
          <Card>
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('enterpriseTitle')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                {t('enterpriseDescription')}
              </p>
              <Button onClick={() => (window.location.href = '/dashboard/settings/plan')}>
                {t('upgradeToEnterprise')}
              </Button>
            </div>
          </Card>
        )}

        {/* SSO Configuration (Enterprise only) */}
        {isEnterprise && (
          <>
            {/* Status */}
            <Card className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      enabled && config?.configured
                        ? 'bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t('ssoStatusTitle')}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {enabled && config?.configured
                        ? t('ssoStatusActive', { provider: providerType.toUpperCase() })
                        : t('ssoStatusNotConfigured')}
                    </p>
                  </div>
                </div>
                {config?.configured && (
                  <Badge variant={enabled ? 'success' : 'default'}>
                    {enabled ? t('enabled') : t('disabled')}
                  </Badge>
                )}
              </div>
            </Card>

            {/* Provider Selection */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('selectProtocol')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleProviderChange('saml')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    providerType === 'saml'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">SAML 2.0</h3>
                    {providerType === 'saml' && (
                      <svg
                        className="w-5 h-5 text-blue-500"
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('samlDescription')}</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleProviderChange('oidc')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    providerType === 'oidc'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">OpenID Connect</h3>
                    {providerType === 'oidc' && (
                      <svg
                        className="w-5 h-5 text-blue-500"
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
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('oidcDescription')}</p>
                </button>
              </div>
            </div>

            {/* Configuration Form */}
            <Card>
              <form onSubmit={handleSave} className="space-y-6">
                {/* SAML Configuration */}
                {providerType === 'saml' && (
                  <>
                    <Input
                      label={t('entityId')}
                      value={entityId}
                      onChange={e => setEntityId(e.target.value)}
                      placeholder={t('entityIdPlaceholder')}
                      helperText={t('entityIdHelper')}
                      disabled={saving}
                      required
                    />

                    <Input
                      label={t('ssoUrl')}
                      type="url"
                      value={ssoUrl}
                      onChange={e => setSsoUrl(e.target.value)}
                      placeholder={t('ssoUrlPlaceholder')}
                      helperText={t('ssoUrlHelper')}
                      disabled={saving}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('certificate')}
                      </label>
                      <textarea
                        value={certificate}
                        onChange={e => setCertificate(e.target.value)}
                        placeholder={
                          config?.certificate
                            ? t('certificatePlaceholderReplace')
                            : t('certificatePlaceholderNew')
                        }
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                        disabled={saving}
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {config?.certificate
                          ? t('certificateHelperConfigured')
                          : t('certificateHelper')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('acsUrl')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={acsUrl}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => copyToClipboard(acsUrl)}
                        >
                          {t('copy')}
                        </Button>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t('acsUrlHelper')}
                      </p>
                    </div>
                  </>
                )}

                {/* OIDC Configuration */}
                {providerType === 'oidc' && (
                  <>
                    <Input
                      label={t('clientId')}
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      placeholder={t('clientIdPlaceholder')}
                      helperText={t('clientIdHelper')}
                      disabled={saving}
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('clientSecret')}
                      </label>
                      <div className="flex-1 relative">
                        <Input
                          type={showClientSecret ? 'text' : 'password'}
                          value={clientSecret}
                          onChange={e => setClientSecret(e.target.value)}
                          placeholder={
                            config?.clientSecret
                              ? t('clientSecretPlaceholderReplace')
                              : t('clientSecretPlaceholderNew')
                          }
                          disabled={saving}
                        />
                        <button
                          type="button"
                          onClick={() => setShowClientSecret(!showClientSecret)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          tabIndex={-1}
                        >
                          {showClientSecret ? (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
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
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {config?.clientSecret
                          ? t('clientSecretHelperConfigured')
                          : t('clientSecretHelper')}
                      </p>
                    </div>

                    <Input
                      label={t('issuerUrl')}
                      type="url"
                      value={issuerUrl}
                      onChange={e => setIssuerUrl(e.target.value)}
                      placeholder={t('issuerUrlPlaceholder')}
                      helperText={t('issuerUrlHelper')}
                      disabled={saving}
                      required
                    />

                    {discoveryUrl && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('discoveryUrl')}
                        </label>
                        <input
                          type="text"
                          value={discoveryUrl}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md font-mono text-sm"
                        />
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {t('discoveryUrlHelper')}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('redirectUri')}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={redirectUri}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => copyToClipboard(redirectUri)}
                        >
                          {t('copy')}
                        </Button>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t('redirectUriHelper')}
                      </p>
                    </div>
                  </>
                )}

                {/* Common Settings */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('settingsTitle')}
                  </h3>

                  <div className="space-y-4">
                    {/* Enable SSO */}
                    <div className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {t('enableSso')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('enableSsoHelper')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Auto-provision */}
                    <div className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {t('autoProvision')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('autoProvisionHelper')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoProvision(!autoProvision)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          autoProvision ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            autoProvision ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Disable password */}
                    <div className="flex items-center justify-between p-4 border border-red-300 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/10">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {t('disablePassword')}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {t('disablePasswordWarning')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDisablePassword(!disablePassword)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          disablePassword ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            disablePassword ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role Mapping */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('roleMappingTitle')}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('roleMappingDescription')}
                      </p>
                    </div>
                    <Button type="button" variant="secondary" onClick={addRoleMapping} size="sm">
                      {t('addMapping')}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {roleMappings.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                        <p className="text-sm">{t('noMappings')}</p>
                        <p className="text-xs mt-1">{t('noMappingsHint')}</p>
                      </div>
                    ) : (
                      roleMappings.map(mapping => (
                        <div
                          key={mapping.id}
                          className="flex gap-3 items-start p-3 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <Input
                              placeholder={t('idpGroupPlaceholder')}
                              value={mapping.idpGroup}
                              onChange={e =>
                                updateRoleMapping(mapping.id, 'idpGroup', e.target.value)
                              }
                              disabled={saving}
                            />
                            <select
                              value={mapping.appRole}
                              onChange={e =>
                                updateRoleMapping(mapping.id, 'appRole', e.target.value)
                              }
                              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={saving}
                            >
                              <option value="viewer">{t('roleViewer')}</option>
                              <option value="member">{t('roleMember')}</option>
                              <option value="admin">{t('roleAdmin')}</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRoleMapping(mapping.id)}
                            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            disabled={saving}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Test Connection */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('testConnection')}
                    </h3>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTestConnection}
                      isLoading={testStatus === 'testing'}
                      disabled={
                        testStatus === 'testing' ||
                        (providerType === 'saml' ? !entityId || !ssoUrl : !clientId || !issuerUrl)
                      }
                    >
                      {t('testConnection')}
                    </Button>
                  </div>

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
                {config?.configured && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('protocol')}</span>
                      <span className="font-medium text-gray-900 dark:text-white uppercase">
                        {config.providerType}
                      </span>
                    </div>
                    {config.updatedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{t('lastUpdated')}</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {new Date(config.updatedAt).toLocaleDateString(undefined, {
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
                    {config?.configured ? t('updateConfiguration') : t('saveConfiguration')}
                  </Button>
                  {config?.configured && (
                    <Button type="button" variant="danger" onClick={handleDelete} disabled={saving}>
                      {t('deleteConfiguration')}
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
