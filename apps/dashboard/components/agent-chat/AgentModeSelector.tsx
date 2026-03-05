'use client';

type AgentMode = 'autonomous' | 'guided';

interface Props {
  value: AgentMode;
  onChange: (mode: AgentMode) => void;
  disabled?: boolean;
}

const MODES: { value: AgentMode; icon: string; label: string; description: string }[] = [
  {
    value: 'autonomous',
    icon: 'Robot',
    label: 'Autonomous',
    description: 'Runs fully autonomously, creates PRs automatically',
  },
  {
    value: 'guided',
    icon: 'User',
    label: 'Guided',
    description: 'Pauses for your review at each step',
  },
];

export function AgentModeSelector({ value, onChange, disabled = false }: Props) {
  return (
    <div
      className="relative flex items-center gap-1.5"
      title={disabled ? 'Mode locked during active session' : undefined}
    >
      <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
        Mode
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value as AgentMode)}
          disabled={disabled}
          className={`appearance-none text-xs pl-2 pr-6 py-1 rounded-lg border bg-gray-900 border-gray-700 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-colors cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-600'
          }`}
        >
          {MODES.map(mode => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        {/* Chevron icon */}
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {/* Mode pill */}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          value === 'autonomous' ? 'bg-blue-900/60 text-blue-300' : 'bg-amber-900/60 text-amber-300'
        }`}
      >
        {value === 'autonomous' ? 'Auto' : 'Guided'}
      </span>
    </div>
  );
}
