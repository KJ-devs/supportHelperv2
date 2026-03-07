'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AuthApiError } from '@/lib/api/auth';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from '@/components/layout/LanguageSelector';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login({ email, password });
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError(t('invalidCredentials'));
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
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={inputClassName}
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {t('rememberMe')}
              </span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('submitting') : t('submit')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('noAccount')}{' '}
          <Link
            href="/signup"
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {t('signUp')}
          </Link>
        </p>
      </div>
    </main>
  );
}
