/**
 * ConnectionStatus
 * Visual indicator for the real-time WebSocket connection state.
 * Green = connected, Orange = reconnecting, Red = disconnected.
 */

'use client';

interface ConnectionStatusProps {
  isConnected: boolean;
  error: string | null;
}

type Status = 'connected' | 'reconnecting' | 'disconnected';

function getStatus(isConnected: boolean, error: string | null): Status {
  if (isConnected) return 'connected';
  // "reconnect_failed" produces a permanent error message; other transient
  // errors (connect_error) appear while the socket is still retrying.
  if (error === 'Real-time connection lost. Please refresh the page.') return 'disconnected';
  if (error === 'Not authenticated') return 'disconnected';
  // No connection yet but still attempting (transient error or initial connect)
  return 'reconnecting';
}

const STATUS_CONFIG = {
  connected: {
    dot: 'bg-green-500',
    pulse: 'bg-green-400',
    label: 'Live',
    tooltip: 'Connecté — mises à jour en temps réel actives',
    textColor: 'text-green-600 dark:text-green-400',
  },
  reconnecting: {
    dot: 'bg-orange-500',
    pulse: 'bg-orange-400',
    label: 'Reconnexion',
    tooltip: 'Reconnexion en cours…',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  disconnected: {
    dot: 'bg-red-500',
    pulse: null,
    label: 'Hors ligne',
    tooltip: 'Déconnecté — les mises à jour en temps réel sont inactives',
    textColor: 'text-red-600 dark:text-red-400',
  },
} satisfies Record<Status, { dot: string; pulse: string | null; label: string; tooltip: string; textColor: string }>;

export function ConnectionStatus({ isConnected, error }: ConnectionStatusProps) {
  const status = getStatus(isConnected, error);
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="relative flex items-center gap-1.5 group"
      title={config.tooltip}
      role="status"
      aria-label={config.tooltip}
    >
      {/* Dot with optional pulse ring for connected/reconnecting */}
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

      {/* Label — hidden on very small screens */}
      <span className={`hidden sm:inline text-xs font-medium ${config.textColor}`}>
        {config.label}
      </span>

      {/* Tooltip (visible on hover via group) */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] rounded-md bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-lg z-50"
        role="tooltip"
      >
        {config.tooltip}
        {/* Arrow */}
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
