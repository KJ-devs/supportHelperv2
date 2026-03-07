'use client';

import { useTranslations } from 'next-intl';

type ModelValue = 'auto' | 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-6';

interface ModelOption {
  value: ModelValue;
  labelKey: string;
  level: 'auto' | 'N1' | 'N2';
  badgeKey?: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'auto',
    labelKey: 'auto',
    level: 'auto',
    badgeKey: 'recommended',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    labelKey: 'haiku',
    level: 'N1',
  },
  {
    value: 'claude-sonnet-4-6',
    labelKey: 'sonnet',
    level: 'N2',
  },
  {
    value: 'claude-opus-4-6',
    labelKey: 'opus',
    level: 'N2',
    badgeKey: 'mostPowerful',
  },
];

const LEVEL_PILL: Record<string, string> = {
  auto: 'bg-gray-700 text-gray-300',
  N1: 'bg-blue-900/60 text-blue-300',
  N2: 'bg-purple-900/60 text-purple-300',
};

interface Props {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

const DEFAULT_OPTION: ModelOption = MODEL_OPTIONS[0]!;

export function ModelSelector({ value, onChange, disabled = false }: Props) {
  const t = useTranslations('modelSelector');
  const selected = MODEL_OPTIONS.find(o => o.value === value) ?? DEFAULT_OPTION;

  return (
    <div
      className="relative flex items-center gap-1.5"
      title={disabled ? t('lockedDuringSession') : undefined}
    >
      <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
        {t('model')}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={`appearance-none text-xs pl-2 pr-6 py-1 rounded-lg border bg-gray-900 border-gray-700 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-colors cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-600'
          }`}
        >
          {MODEL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey as any)}
            </option>
          ))}
        </select>
        {/* Chevron icon */}
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* Level pill for selected option */}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LEVEL_PILL[selected.level]}`}
      >
        {selected.level === 'auto' ? t('autoShort') : selected.level}
      </span>

      {selected.badgeKey && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300 font-medium">
          {t(selected.badgeKey as any)}
        </span>
      )}
    </div>
  );
}
