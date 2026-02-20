'use client';

export type AgentStateValue =
  | 'analyzing'
  | 'needs_info'
  | 'proposing'
  | 'waiting'
  | 'resolved'
  | 'escalated'
  | string;

interface StateConfig {
  label: string;
  /** Tailwind classes for the badge background, text, and ring */
  badgeClasses: string;
  /** Tailwind classes for the indicator dot */
  dotClasses: string;
  pulse: boolean;
}

const STATE_CONFIG: Record<string, StateConfig> = {
  analyzing: {
    label: 'Analyzing',
    badgeClasses:
      'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-700',
    dotClasses: 'bg-blue-500',
    pulse: true,
  },
  needs_info: {
    label: 'Needs Info',
    badgeClasses:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700',
    dotClasses: 'bg-amber-500',
    pulse: false,
  },
  proposing: {
    label: 'Proposing Solution',
    badgeClasses:
      'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700',
    dotClasses: 'bg-indigo-500',
    pulse: true,
  },
  waiting: {
    label: 'Waiting',
    badgeClasses:
      'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
    dotClasses: 'bg-gray-400',
    pulse: false,
  },
  resolved: {
    label: 'Resolved',
    badgeClasses:
      'bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700',
    dotClasses: 'bg-green-500',
    pulse: false,
  },
  escalated: {
    label: 'Escalated',
    badgeClasses:
      'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700',
    dotClasses: 'bg-red-500',
    pulse: false,
  },
};

const FALLBACK_CONFIG: StateConfig = {
  label: 'Unknown',
  badgeClasses:
    'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
  dotClasses: 'bg-gray-400',
  pulse: false,
};

interface AgentStateIndicatorProps {
  state: AgentStateValue;
  /** Show a pulsing dot when the agent is actively processing */
  isTyping?: boolean;
  /** 'badge' renders a full pill badge; 'dot' renders only the indicator dot + label */
  variant?: 'badge' | 'dot';
  className?: string;
}

export function AgentStateIndicator({
  state,
  isTyping = false,
  variant = 'badge',
  className = '',
}: AgentStateIndicatorProps) {
  const config = STATE_CONFIG[state] ?? FALLBACK_CONFIG;
  const shouldPulse = config.pulse || isTyping;

  if (variant === 'dot') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="relative flex h-2.5 w-2.5">
          {shouldPulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotClasses} opacity-70`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dotClasses}`} />
        </span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeClasses} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {shouldPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotClasses} opacity-70`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClasses}`} />
      </span>
      {config.label}
    </span>
  );
}
