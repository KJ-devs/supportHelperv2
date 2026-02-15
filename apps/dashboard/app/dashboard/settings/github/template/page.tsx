'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button } from '@/components/ui';
import { applicationsApi } from '@/lib/api/applications';
import {
  githubApi,
  type IssueTemplateResponse,
  type TemplatePreviewResponse,
} from '@/lib/api/github';
import type { Application } from '@/lib/types/application';

export default function GitHubTemplatePage() {
  const { isLoading: authLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const appIdParam = searchParams.get('appId');

  // State
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>(appIdParam || '');
  const [template, setTemplate] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<TemplatePreviewResponse | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

  // Fetch applications
  useEffect(() => {
    if (authLoading) return;
    applicationsApi.getApplications().then((apps) => {
      setApplications(apps || []);
      if (!selectedAppId && apps.length > 0) {
        setSelectedAppId(apps[0].id);
      }
    });
  }, [authLoading, selectedAppId]);

  // Fetch template when app selection changes
  const fetchTemplate = useCallback(async () => {
    if (!selectedAppId) return;
    try {
      setLoading(true);
      const data: IssueTemplateResponse =
        await githubApi.getIssueTemplate(selectedAppId);
      setTemplate(data.template);
      setIsDefault(data.isDefault);
      setPlaceholders(data.placeholders);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [selectedAppId, showToast]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Save template
  const handleSave = async () => {
    if (!selectedAppId) return;
    try {
      setSaving(true);
      const result = await githubApi.updateIssueTemplate(
        selectedAppId,
        template
      );
      setIsDefault(result.isDefault);
      showToast('success', 'Template saved successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Preview template
  const handlePreview = async () => {
    if (!selectedAppId) return;
    try {
      setPreviewing(true);
      const result = await githubApi.previewIssueTemplate(
        selectedAppId,
        template
      );
      setPreview(result);
      setShowPreview(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to preview template');
    } finally {
      setPreviewing(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!selectedAppId) return;
    try {
      setLoading(true);
      const result = await githubApi.resetIssueTemplate(selectedAppId);
      setTemplate(result.template);
      setIsDefault(result.isDefault);
      setPlaceholders(result.placeholders);
      setShowPreview(false);
      setPreview(null);
      showToast('success', 'Template reset to default');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reset template');
    } finally {
      setLoading(false);
    }
  };

  // Insert placeholder at cursor position
  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById(
      'template-editor'
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue =
      template.substring(0, start) + placeholder + template.substring(end);
    setTemplate(newValue);

    // Restore cursor after the inserted placeholder
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + placeholder.length;
      textarea.selectionEnd = start + placeholder.length;
    });
  };

  if (authLoading) {
    return <PageLoader />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{toast.type === 'success' ? 'OK' : '!'}</span>
              <span className="text-sm font-medium">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </div>
          </div>
        )}

        {/* Header / Breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <a
              href="/dashboard/settings"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Settings
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <a
              href="/dashboard/settings/github"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              GitHub
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">
              Issue Template
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Issue Template Editor
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize the markdown template used when creating GitHub issues from
            tickets. Use placeholders to include ticket data automatically.
          </p>
        </div>

        {/* Application Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Application
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="block w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an application...</option>
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.platform})
              </option>
            ))}
          </select>
        </div>

        {!selectedAppId ? (
          <Card>
            <div className="text-center py-12 text-gray-500">
              <p>Select an application above to configure its issue template.</p>
            </div>
          </Card>
        ) : loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full" />
              <span className="ml-3 text-sm text-gray-500">
                Loading template...
              </span>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Template Editor */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Template
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {isDefault ? 'Using default template' : 'Using custom template'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={loading}
                      >
                        Reset to default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePreview}
                      isLoading={previewing}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      isLoading={saving}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                <textarea
                  id="template-editor"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={24}
                  className="w-full font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                  placeholder="Enter your issue template here..."
                  spellCheck={false}
                />
              </Card>

              {/* Preview Panel */}
              {showPreview && preview && (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Preview
                    </h2>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      Close
                    </button>
                  </div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 overflow-auto"
                    style={{ maxHeight: '500px' }}
                  >
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {preview.rendered}
                    </pre>
                  </div>
                </Card>
              )}
            </div>

            {/* Right: Placeholders panel */}
            <div className="lg:col-span-1">
              <Card>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Available Placeholders
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Click a placeholder to insert it at the cursor position in the
                  template editor.
                </p>
                <div className="space-y-2">
                  {Object.entries(placeholders).map(([placeholder, description]) => (
                    <button
                      key={placeholder}
                      onClick={() => insertPlaceholder(placeholder)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group"
                    >
                      <code className="text-xs font-mono text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {placeholder}
                      </code>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {description}
                      </p>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
