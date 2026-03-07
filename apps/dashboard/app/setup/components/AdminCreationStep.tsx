'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface AdminCreationStepProps {
  onComplete: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminCreationStep({
  onComplete,
  isLoading,
  setIsLoading,
}: AdminCreationStepProps) {
  const t = useTranslations('setupAdmin');
  const [formData, setFormData] = useState({
    organizationName: '',
    adminName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const inputClassName =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500';

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.organizationName.trim()) {
      newErrors.organizationName = t('orgRequired');
    }

    if (!formData.adminName.trim()) {
      newErrors.adminName = t('nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('emailInvalid');
    }

    if (!formData.password) {
      newErrors.password = t('passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('passwordTooShort');
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('confirmRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('passwordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/setup/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantName: formData.organizationName,
          name: formData.adminName,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: t('createFailed') }));
        throw new Error(error.message || t('createFailed'));
      }

      const data = await response.json();

      localStorage.setItem('auth_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refresh_token', data.refreshToken);
      }

      onComplete();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : t('createFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('title')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
            {apiError}
          </div>
        )}

        <div>
          <label
            htmlFor="organizationName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('orgName')} <span className="text-red-500">*</span>
          </label>
          <input
            id="organizationName"
            type="text"
            value={formData.organizationName}
            onChange={e => handleChange('organizationName', e.target.value)}
            className={inputClassName}
            placeholder={t('orgPlaceholder')}
          />
          {errors.organizationName && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.organizationName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="adminName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('adminName')} <span className="text-red-500">*</span>
          </label>
          <input
            id="adminName"
            type="text"
            value={formData.adminName}
            onChange={e => handleChange('adminName', e.target.value)}
            className={inputClassName}
            placeholder={t('adminPlaceholder')}
          />
          {errors.adminName && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.adminName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('email')} <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={e => handleChange('email', e.target.value)}
            className={inputClassName}
            placeholder="admin@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('password')} <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            className={inputClassName}
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('confirmPassword')} <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={e => handleChange('confirmPassword', e.target.value)}
            className={inputClassName}
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? t('creating') : t('submit')}
        </button>
      </form>
    </div>
  );
}
