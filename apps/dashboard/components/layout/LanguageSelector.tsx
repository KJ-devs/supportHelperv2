'use client';

import { useTranslations } from 'next-intl';

const LOCALES = [
  { value: 'fr', label: 'FR' },
  { value: 'en', label: 'EN' },
] as const;

export function LanguageSelector() {
  const t = useTranslations('language');

  const getCurrentLocale = (): string => {
    if (typeof document === 'undefined') return 'fr';
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    return match?.[1] ?? 'fr';
  };

  const handleChange = (locale: string) => {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  };

  const currentLocale = getCurrentLocale();

  return (
    <div className="relative flex items-center" title={t('selectLanguage')}>
      <select
        value={currentLocale}
        onChange={e => handleChange(e.target.value)}
        className="appearance-none text-xs pl-2 pr-6 py-1 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[32px]"
        aria-label={t('selectLanguage')}
      >
        {LOCALES.map(locale => (
          <option key={locale.value} value={locale.value}>
            {locale.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
