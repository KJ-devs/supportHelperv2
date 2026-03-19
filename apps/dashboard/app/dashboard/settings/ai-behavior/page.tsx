'use client';

import { useState, useEffect, useId } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/lib/auth';
import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Select, Badge, useToast } from '@/components/ui';
import { aiPromptConfigApi, type AiPromptConfigResponse } from '@/lib/api/ai-prompt-config';
import { ApiError } from '@/lib/api/client';

const MAX_LENGTH = 2000;

const TRIAGE_TEMPLATE = `- Our product is a REST API for inventory management
- 404 errors on /api/v1/* are usually incorrect IDs, not bugs
- Timeouts > 30s are severity critical (our SLA is 5s)
- CORS errors usually come from client-side misconfiguration`;

const N1_TEMPLATE = `- Tickets mentioning "legacy" or "/v1/" concern the old API, prefer no_fix_needed if a /v2/ equivalent exists
- Never mark as duplicate if app versions differ
- SSO-related errors must always escalate to N2 (security impact)`;

const ANALYSIS_TEMPLATE = `- Our code convention: NestJS modules in src/modules/{domain}/
- Tests are in test/unit/ and test/e2e/
- Never modify files in src/core/ without human escalation
- Main branch is main, create fix branches from main`;

const LANGUAGE_OPTIONS = [
  { value: '', labelKey: 'langAuto' },
  { value: 'en', labelKey: 'langEn' },
  { value: 'fr', labelKey: 'langFr' },
  { value: 'de', labelKey: 'langDe' },
  { value: 'es', labelKey: 'langEs' },
  { value: 'it', labelKey: 'langIt' },
  { value: 'pt', labelKey: 'langPt' },
  { value: 'nl', labelKey: 'langNl' },
  { value: 'ja', labelKey: 'langJa' },
  { value: 'ko', labelKey: 'langKo' },
  { value: 'zh', labelKey: 'langZh' },
  { value: 'ar', labelKey: 'langAr' },
  { value: 'ru', labelKey: 'langRu' },
] as const;

interface FormState {
  productDescription: string;
  globalInstructions: string;
  triageInstructions: string;
  n1Instructions: string;
  analysisInstructions: string;
  responseLanguage: string;
  enableTriage: boolean;
  enableN1: boolean;
  enableN2: boolean;
}

interface FeatureFlagRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}

function FeatureFlagRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: FeatureFlagRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-900 dark:text-white cursor-pointer"
        >
          {label}
        </label>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const count = value.length;
  const isNearLimit = count > max * 0.9;
  const isAtLimit = count >= max;

  return (
    <span
      className={`text-xs tabular-nums ${
        isAtLimit
          ? 'text-red-600 dark:text-red-400'
          : isNearLimit
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      {count}/{max}
    </span>
  );
}

interface TextareaFieldProps {
  id: string;
  label: string;
  helperText: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onLoadTemplate?: () => void;
  loadTemplateLabel?: string;
}

function TextareaField({
  id,
  label,
  helperText,
  placeholder,
  value,
  onChange,
  disabled,
  onLoadTemplate,
  loadTemplateLabel,
}: TextareaFieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <CharCount value={value} max={MAX_LENGTH} />
      </div>
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        rows={4}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-y"
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        {onLoadTemplate && (
          <button
            type="button"
            disabled={disabled}
            onClick={onLoadTemplate}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-4"
          >
            {loadTemplateLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AiBehaviorPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const t = useTranslations('settingsAiBehavior');
  const toast = useToast();
  const formId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [initialForm, setInitialForm] = useState<FormState | null>(null);

  const [form, setForm] = useState<FormState>({
    productDescription: '',
    globalInstructions: '',
    triageInstructions: '',
    n1Instructions: '',
    analysisInstructions: '',
    responseLanguage: '',
    enableTriage: true,
    enableN1: true,
    enableN2: true,
  });

  const languageOptions = LANGUAGE_OPTIONS.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey as Parameters<typeof t>[0]),
  }));

  useEffect(() => {
    if (authLoading) return;

    const loadConfig = async () => {
      try {
        const data: AiPromptConfigResponse = await aiPromptConfigApi.getConfig();
        setConfigured(data.configured);
        const loaded: FormState = {
          productDescription: data.productDescription ?? '',
          globalInstructions: data.globalInstructions ?? '',
          triageInstructions: data.triageInstructions ?? '',
          n1Instructions: data.n1Instructions ?? '',
          analysisInstructions: data.analysisInstructions ?? '',
          responseLanguage: data.responseLanguage ?? '',
          enableTriage: data.enableTriage ?? true,
          enableN1: data.enableN1 ?? true,
          enableN2: data.enableN2 ?? true,
        };
        setForm(loaded);
        setInitialForm(loaded);
      } catch {
        toast.error(t('title'), t('loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const setField = (field: keyof FormState) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const setFlag = (field: 'enableTriage' | 'enableN1' | 'enableN2') => (value: boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const loadTemplate =
    (field: 'triageInstructions' | 'n1Instructions' | 'analysisInstructions', template: string) =>
    () => {
      if (form[field] && !window.confirm(t('loadTemplateConfirm'))) return;
      setForm(prev => ({ ...prev, [field]: template }));
    };

  const isDirty = initialForm && JSON.stringify(form) !== JSON.stringify(initialForm);

  const handleReset = () => {
    if (initialForm) setForm(initialForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updated = await aiPromptConfigApi.updateConfig({
        productDescription: form.productDescription,
        globalInstructions: form.globalInstructions,
        triageInstructions: form.triageInstructions,
        n1Instructions: form.n1Instructions,
        analysisInstructions: form.analysisInstructions,
        responseLanguage: form.responseLanguage,
        enableTriage: form.enableTriage,
        enableN1: form.enableN1,
        enableN2: form.enableN2,
      });
      setConfigured(updated.configured);
      setInitialForm({ ...form });
      toast.success(t('title'), t('saveSuccess'));
    } catch (err: unknown) {
      const message =
        err instanceof ApiError && err.statusCode === 403
          ? t('permissionError')
          : err instanceof Error
            ? err.message
            : t('saveError');
      toast.error(t('title'), message);
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
          <div className="flex items-center space-x-2 mb-2 text-sm">
            <Link
              href="/dashboard/settings"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {t('breadcrumbSettings')}
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-900 dark:text-white font-medium">{t('title')}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>

        {/* Status banner */}
        <div className="mb-6">
          {configured ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  {t('configuredBanner')}
                </p>
              </div>
              <Badge variant="success">{t('configuredBadge')}</Badge>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('notConfiguredBanner')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('notConfiguredDetail')}
                  </p>
                </div>
              </div>
              <Badge variant="default">{t('notConfiguredBadge')}</Badge>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* AI Pipeline Features */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              {t('pipelineFeaturesTitle')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t('pipelineFeaturesDescription')}
            </p>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <FeatureFlagRow
                id={`${formId}-enableTriage`}
                label={t('enableTriageLabel')}
                description={t('enableTriageDescription')}
                checked={form.enableTriage}
                onChange={setFlag('enableTriage')}
                disabled={saving}
              />
              <FeatureFlagRow
                id={`${formId}-enableN1`}
                label={t('enableN1Label')}
                description={t('enableN1Description')}
                checked={form.enableN1}
                onChange={setFlag('enableN1')}
                disabled={saving}
              />
              <FeatureFlagRow
                id={`${formId}-enableN2`}
                label={t('enableN2Label')}
                description={t('enableN2Description')}
                checked={form.enableN2}
                onChange={setFlag('enableN2')}
                disabled={saving}
              />
            </div>
          </Card>

          {/* Product Context */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {t('productContextTitle')}
            </h2>
            <TextareaField
              id={`${formId}-product`}
              label={t('productDescriptionLabel')}
              helperText={t('productDescriptionHelper')}
              placeholder={t('productDescriptionPlaceholder')}
              value={form.productDescription}
              onChange={setField('productDescription')}
              disabled={saving}
            />
          </Card>

          {/* Response Language */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {t('responseLanguageTitle')}
            </h2>
            <Select
              label={t('responseLanguageLabel')}
              options={languageOptions}
              value={form.responseLanguage}
              onChange={e => setField('responseLanguage')(e.target.value)}
              disabled={saving}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('responseLanguageHelper')}
            </p>
          </Card>

          {/* Global Instructions */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {t('globalInstructionsTitle')}
            </h2>
            <TextareaField
              id={`${formId}-global`}
              label={t('globalInstructionsLabel')}
              helperText={t('globalInstructionsHelper')}
              placeholder={t('globalInstructionsPlaceholder')}
              value={form.globalInstructions}
              onChange={setField('globalInstructions')}
              disabled={saving}
            />
          </Card>

          {/* Triage Instructions */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {t('triageInstructionsTitle')}
            </h2>
            <TextareaField
              id={`${formId}-triage`}
              label={t('triageInstructionsLabel')}
              helperText={t('triageInstructionsHelper')}
              placeholder={t('triageInstructionsPlaceholder')}
              value={form.triageInstructions}
              onChange={setField('triageInstructions')}
              disabled={saving}
              onLoadTemplate={loadTemplate('triageInstructions', TRIAGE_TEMPLATE)}
              loadTemplateLabel={t('loadTemplate')}
            />
          </Card>

          {/* N1 Assessment Instructions */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {t('n1InstructionsTitle')}
            </h2>
            <TextareaField
              id={`${formId}-n1`}
              label={t('n1InstructionsLabel')}
              helperText={t('n1InstructionsHelper')}
              placeholder={t('n1InstructionsPlaceholder')}
              value={form.n1Instructions}
              onChange={setField('n1Instructions')}
              disabled={saving}
              onLoadTemplate={loadTemplate('n1Instructions', N1_TEMPLATE)}
              loadTemplateLabel={t('loadTemplate')}
            />
          </Card>

          {/* Analysis Instructions */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              {t('analysisInstructionsTitle')}
            </h2>
            <TextareaField
              id={`${formId}-analysis`}
              label={t('analysisInstructionsLabel')}
              helperText={t('analysisInstructionsHelper')}
              placeholder={t('analysisInstructionsPlaceholder')}
              value={form.analysisInstructions}
              onChange={setField('analysisInstructions')}
              disabled={saving}
              onLoadTemplate={loadTemplate('analysisInstructions', ANALYSIS_TEMPLATE)}
              loadTemplateLabel={t('loadTemplate')}
            />
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 pb-8">
            <Button type="submit" isLoading={saving} disabled={saving || !isDirty}>
              {t('saveButton')}
            </Button>
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
              >
                {t('resetButton')}
              </button>
            )}
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
