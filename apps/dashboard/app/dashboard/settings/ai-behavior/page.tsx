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
  analysisInstructions: string;
  responseLanguage: string;
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
}

function TextareaField({
  id,
  label,
  helperText,
  placeholder,
  value,
  onChange,
  disabled,
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
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
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
    analysisInstructions: '',
    responseLanguage: '',
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
          analysisInstructions: data.analysisInstructions ?? '',
          responseLanguage: data.responseLanguage ?? '',
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
        analysisInstructions: form.analysisInstructions,
        responseLanguage: form.responseLanguage,
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
