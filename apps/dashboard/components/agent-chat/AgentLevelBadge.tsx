'use client';

interface AgentLevelBadgeProps {
  level: 'N1' | 'N2' | null;
  model?: string | null;
  isActive?: boolean;
}

export function AgentLevelBadge({ level, model, isActive = false }: AgentLevelBadgeProps) {
  if (!level) return null;

  const isN1 = level === 'N1';

  const ringColor = isN1 ? 'ring-blue-500/60' : 'ring-purple-500/60';
  const badgeBg = isN1
    ? 'bg-blue-900/50 border-blue-700/60'
    : 'bg-purple-900/50 border-purple-700/60';
  const textColor = isN1 ? 'text-blue-300' : 'text-purple-300';
  const icon = isN1 ? '⚡' : '🔬';
  const label = isN1 ? 'N1 · Fast Analysis' : 'N2 · Deep Investigation';

  return (
    <div className="flex flex-col items-start gap-0.5">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${badgeBg} ${textColor} ${
          isActive ? `ring-1 ${ringColor} animate-pulse` : ''
        }`}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      {model && (
        <span className="text-[10px] text-gray-600 pl-1 font-mono truncate max-w-[140px]">
          {model}
        </span>
      )}
    </div>
  );
}
