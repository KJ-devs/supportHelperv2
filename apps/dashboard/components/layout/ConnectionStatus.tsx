/**
 * ConnectionStatus
 * Visual indicator for the real-time WebSocket connection state.
 */

'use client';

import { useTranslations } from 'next-intl';

interface ConnectionStatusProps {
  isConnected: boolean;
  error: string | null;
}

type Status = 'connected' | 'reconnecting' | 'disconnected';

function getStatus(isConnected: boolean, error: string | null): Status {
  if (isConnected) return 'connected';
  if (error === 'Real-time connection lost. Please refresh the page.') return 'disconnected';
  if (error === 'Not authenticated') return 'disconnected';
  return 'reconnecting';
}

export function ConnectionStatus({ isConnected, error }: ConnectionStatusProps) {
  const t = useTranslations('connection');
  const status = getStatus(isConnected, error);

  const STATUS_CONFIG = {
    connected: {
      dot: 'bg-green-500',
      pulse: 'bg-green-400',
      label: t('connected'),
      tooltip: t('connectedTooltip'),
      textColor: 'text-green-600 dark:text-green-400',
    },
    reconnecting: {
      dot: 'bg-orange-500',
      pulse: 'bg-orange-400',
      label: t('reconnecting'),
      tooltip: t('reconnectingTooltip'),
      textColor: 'text-orange-600 dark:text-orange-400',
    },
    disconnected: {
      dot: 'bg-red-500',
      pulse: null,
      label: t('disconnected'),
      tooltip: t('disconnectedTooltip'),
      textColor: 'text-red-600 dark:text-red-400',
    },
  };

  const config = STATUS_CONFIG[status];

  return (
    <div
      className="relative flex items-center gap-1.5 group"
      title={config.tooltip}
      role="status"
      aria-label={config.tooltip}
    >
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${config.pulse}`}
            aria-hidden="true"
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.dot}`}
          aria-hidden="true"
        />
      </span>

      <span className={`hidden sm:inline text-xs font-medium ${config.textColor}`}>
        {config.label}
      </span>

      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] rounded-md bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-lg z-50"
        role="tooltip"
      >
        {config.tooltip}
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
