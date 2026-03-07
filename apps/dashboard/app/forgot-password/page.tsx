'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi, AuthApiError } from '@/lib/api/auth';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from '@/components/layout/LanguageSelector';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError(t('sendFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500';

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-gray-800/20">
        <div className="flex justify-end mb-2">
          <LanguageSelector />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('subtitle')}</p>
        </div>

        {success ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-md">
              <p className="font-medium mb-1">{t('successTitle')}</p>
              <p className="text-sm">{t('successMessage', { email })}</p>
            </div>
            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <p>{t('notReceived')}</p>
              <button
                onClick={() => setSuccess(false)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {t('tryAgain')}
              </button>
            </div>
            <Link
              href="/login"
              className="block w-full py-2 px-4 text-center bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {t('backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputClassName}
                placeholder={t('emailPlaceholder')}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('submitting') : t('submit')}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
