'use client';

interface AgentStatusProps {
  state: string;
  isTyping: boolean;
}

const stateConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
  analyzing: { label: 'Analyzing', color: 'bg-yellow-400', pulse: true },
  needs_info: { label: 'Needs Info', color: 'bg-yellow-400', pulse: false },
  proposing: { label: 'Proposing Solution', color: 'bg-yellow-400', pulse: true },
  waiting: { label: 'Waiting', color: 'bg-blue-400', pulse: false },
  resolved: { label: 'Resolved', color: 'bg-green-400', pulse: false },
  escalated: { label: 'Escalated', color: 'bg-red-400', pulse: false },
};

export function AgentStatus({ state, isTyping }: AgentStatusProps) {
  const config = stateConfig[state] || { label: state, color: 'bg-gray-400', pulse: false };
  const shouldPulse = config.pulse || isTyping;

  return (
    <div className="flex items-center space-x-2">
      <span className="relative flex h-3 w-3">
        {shouldPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${config.color}`} />
      </span>
      <span className="text-sm font-medium text-gray-700">{config.label}</span>
      {isTyping && <TypingDots />}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center space-x-0.5 ml-1">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}
