'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, AuthApiError } from '@/lib/api/auth';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from '@/components/layout/LanguageSelector';

function ResetPasswordForm() {
  const t = useTranslations('auth.resetPassword');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError(t('invalidToken'));
    }
  }, [token, t]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8)
      return t('passwordTooShort' as any) || 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return t('mustUppercase');
    if (!/[a-z]/.test(pwd)) return t('mustLowercase');
    if (!/[0-9]/.test(pwd)) return t('mustNumber');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('passwordMismatch' as any) || 'Passwords do not match');
      setIsLoading(false);
      return;
    }

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    if (!token) {
      setError(t('invalidToken'));
      setIsLoading(false);
      return;
    }

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.statusCode === 400 || err.statusCode === 404) {
          setError(t('expiredToken'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('resetFailed'));
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
              <p className="text-sm">{t('successMessage')}</p>
            </div>
            <Link
              href="/login"
              className="block w-full py-2 px-4 text-center bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {t('goToLogin')}
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
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('newPassword')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={!token || isLoading}
                className={inputClassName}
                placeholder="••••••••"
                autoFocus
              />
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('requirementsTitle')}</p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc list-inside space-y-0.5">
                  <li>{t('reqLength')}</li>
                  <li>{t('reqUppercase')}</li>
                  <li>{t('reqLowercase')}</li>
                  <li>{t('reqNumber')}</li>
                </ul>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={!token || isLoading}
                className={inputClassName}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
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

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
          <div className="text-gray-600 dark:text-gray-400">{t('loading')}</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
