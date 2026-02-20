'use client';

const TOOL_ICONS: Record<string, string> = {
  read_file: '📂',
  list_directory: '📁',
  search_code: '🔍',
  search_codebase_semantic: '🧠',
  get_repo_structure: '🗂️',
  get_file_history: '📜',
  get_file_blame: '👤',
  update_diagnosis: '📊',
  search_similar_tickets: '🎫',
  get_ticket_details: '📋',
  update_ticket_status: '🔄',
  escalate_to_human: '👤',
};

interface ToolCallBadgeProps {
  toolName: string;
}

export function ToolCallBadge({ toolName }: ToolCallBadgeProps) {
  const icon = TOOL_ICONS[toolName] ?? '🔧';
  const label = toolName.replace(/_/g, ' ');

  return (
    <span
      title={toolName}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full border border-gray-200 dark:border-gray-700"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
