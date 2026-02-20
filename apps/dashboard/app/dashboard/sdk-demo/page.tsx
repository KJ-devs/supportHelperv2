/**
 * SDK Demo Page
 * Test the Support Helper widget live inside the dashboard
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Script from 'next/script';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Play, Square, Trash2, Puzzle } from 'lucide-react';

interface EventLog {
  id: number;
  time: string;
  event: string;
  detail: string;
}

const SDK_EVENTS = [
  'sh:open',
  'sh:close',
  'sh:recording-start',
  'sh:recording-stop',
  'sh:submit',
  'sh:error',
];

const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;
const THEMES = ['auto', 'light', 'dark'] as const;

export default function SdkDemoPage() {
  const { isLoading: authLoading } = useRequireAuth();

  const [sdkKey, setSdkKey] = useState('sdk_test_default_key_12345');
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [position, setPosition] = useState<string>('bottom-right');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [theme, setTheme] = useState<string>('auto');

  const [isWidgetActive, setIsWidgetActive] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [events, setEvents] = useState<EventLog[]>([]);
  const eventIdRef = useRef(0);
  const widgetRef = useRef<HTMLElement | null>(null);

  const addEvent = useCallback((eventName: string, detail?: unknown) => {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setEvents((prev) => [
      {
        id: ++eventIdRef.current,
        time,
        event: eventName,
        detail: detail ? JSON.stringify(detail) : '',
      },
      ...prev,
    ]);
  }, []);

  const handleLaunchWidget = useCallback(() => {
    if (!scriptLoaded) return;

    // Remove existing widget if any
    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    const win = window as Window & { SupportHelper?: { init: (opts: Record<string, unknown>) => HTMLElement } };
    if (!win.SupportHelper) {
      addEvent('error', { message: 'SupportHelper not loaded' });
      return;
    }

    const element = win.SupportHelper.init({
      sdkKey,
      apiUrl,
      position,
      primaryColor,
      theme,
    });

    // Attach event listeners
    SDK_EVENTS.forEach((eventName) => {
      element.addEventListener(eventName, ((e: CustomEvent) => {
        addEvent(eventName, e.detail);
      }) as EventListener);
    });

    widgetRef.current = element;
    setIsWidgetActive(true);
    addEvent('widget-launched', { sdkKey, apiUrl, position, primaryColor, theme });
  }, [scriptLoaded, sdkKey, apiUrl, position, primaryColor, theme, addEvent]);

  const handleStopWidget = useCallback(() => {
    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }
    setIsWidgetActive(false);
    addEvent('widget-stopped');
  }, [addEvent]);

  // Cleanup widget on unmount
  useEffect(() => {
    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
      }
    };
  }, []);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Script src="/sdk.iife.js" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Puzzle className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SDK Demo</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Testez le widget Support Helper en direct. Configurez les options puis lancez le widget.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Configuration</h2>

          <div className="space-y-4">
            {/* SDK Key */}
            <div>
              <label htmlFor="sdk-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SDK Key
              </label>
              <input
                id="sdk-key"
                type="text"
                value={sdkKey}
                onChange={(e) => setSdkKey(e.target.value)}
                disabled={isWidgetActive}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* API URL */}
            <div>
              <label htmlFor="api-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API URL
              </label>
              <input
                id="api-url"
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                disabled={isWidgetActive}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* Position */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Position
              </label>
              <select
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={isWidgetActive}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Primary Color */}
            <div>
              <label htmlFor="primary-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur primaire
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={isWidgetActive}
                  className="h-10 w-14 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer disabled:opacity-50"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={isWidgetActive}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Theme */}
            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Theme
              </label>
              <select
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                disabled={isWidgetActive}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
              >
                {THEMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            {!isWidgetActive ? (
              <button
                onClick={handleLaunchWidget}
                disabled={!scriptLoaded || !sdkKey}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Lancer le widget
              </button>
            ) : (
              <button
                onClick={handleStopWidget}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Square className="w-4 h-4" />
                Arreter le widget
              </button>
            )}
          </div>

          {!scriptLoaded && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
              Chargement du SDK en cours...
            </p>
          )}
        </div>

        {/* Event Log Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Events
              {events.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({events.length})
                </span>
              )}
            </h2>
            {events.length > 0 && (
              <button
                onClick={() => setEvents([])}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Effacer
              </button>
            )}
          </div>

          <div className="h-[400px] overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            {events.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                Les events du widget apparaitront ici
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {events.map((log) => (
                  <div key={log.id} className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500 font-mono text-xs shrink-0">
                        {log.time}
                      </span>
                      <span className={`font-medium ${getEventColor(log.event)}`}>
                        {log.event}
                      </span>
                    </div>
                    {log.detail && (
                      <pre className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-pre-wrap break-all">
                        {log.detail}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function getEventColor(event: string): string {
  switch (event) {
    case 'sh:open':
      return 'text-green-600 dark:text-green-400';
    case 'sh:close':
      return 'text-gray-600 dark:text-gray-400';
    case 'sh:recording-start':
      return 'text-blue-600 dark:text-blue-400';
    case 'sh:recording-stop':
      return 'text-blue-600 dark:text-blue-400';
    case 'sh:submit':
      return 'text-indigo-600 dark:text-indigo-400';
    case 'sh:error':
      return 'text-red-600 dark:text-red-400';
    case 'widget-launched':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'widget-stopped':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}
