'use client';

import { useState } from 'react';

interface EmailConfigStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EmailConfigStep({ onComplete, onSkip }: EmailConfigStepProps) {
  const [formData, setFormData] = useState({
    host: '',
    port: '587',
    username: '',
    password: '',
    fromEmail: '',
    secure: false,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  const inputClassName = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500";

  const handleChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
    setTestResult(null);
    setError('');
  };

  const handleTest = async () => {
    if (!formData.host || !formData.username || !formData.password || !formData.fromEmail) {
      setError('Please fill in all required fields before testing');
      return;
    }

    setIsTesting(true);
    setError('');
    setTestResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/setup/smtp-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Test failed');
      }

      if (data.success) {
        setTestResult({ success: true, message: 'Connection successful! Test email sent.' });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to test connection',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.host || !formData.username || !formData.password || !formData.fromEmail) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/setup/smtp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save configuration');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Email Configuration (Optional)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure SMTP settings to enable email notifications for tickets and system alerts.
        </p>
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Optional:</strong> You can skip this step and configure email settings later.
          Email notifications will not be sent until SMTP is configured.
        </p>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}

        {testResult && (
          <div className={`p-3 border rounded-md text-sm ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            {testResult.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="host" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SMTP Host
            </label>
            <input
              id="host"
              type="text"
              value={formData.host}
              onChange={e => handleChange('host', e.target.value)}
              className={inputClassName}
              placeholder="smtp.gmail.com"
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Port
            </label>
            <input
              id="port"
              type="number"
              value={formData.port}
              onChange={e => handleChange('port', e.target.value)}
              className={inputClassName}
              placeholder="587"
            />
          </div>
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={formData.username}
            onChange={e => handleChange('username', e.target.value)}
            className={inputClassName}
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            className={inputClassName}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            From Email Address
          </label>
          <input
            id="fromEmail"
            type="email"
            value={formData.fromEmail}
            onChange={e => handleChange('fromEmail', e.target.value)}
            className={inputClassName}
            placeholder="noreply@example.com"
          />
        </div>

        <div className="flex items-center">
          <input
            id="secure"
            type="checkbox"
            checked={formData.secure}
            onChange={e => handleChange('secure', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded"
          />
          <label htmlFor="secure" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Use TLS/SSL (secure connection)
          </label>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleTest}
            disabled={isTesting || !formData.host || !formData.username || !formData.password || !formData.fromEmail}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !formData.host || !formData.username || !formData.password || !formData.fromEmail}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>

        <button
          onClick={onSkip}
          className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
        >
          Skip Email Configuration
        </button>
      </div>
    </div>
  );
}
