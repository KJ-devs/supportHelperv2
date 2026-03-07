'use client';

import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('page');

  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          {t('landingTitle')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{t('landingSubtitle')}</p>
        <div className="space-x-4">
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('login')}
          </a>
          <a
            href="/signup"
            className="inline-block px-6 py-2 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            {t('signUp')}
          </a>
        </div>
      </div>
    </main>
  );
}
