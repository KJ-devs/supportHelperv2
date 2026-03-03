'use client';

import { Integration } from '@/lib/types/integration';

interface IntegrationCardProps {
  integration: Integration;
  onEdit: (integration: Integration) => void;
  onDelete: (integration: Integration) => void;
  onTest: (integration: Integration) => void;
  onSync: (integration: Integration) => void;
  onViewLogs: (integration: Integration) => void;
}

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
    <path
      d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      fill="#E01E5A"
    />
    <path
      d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      fill="#36C5F0"
    />
    <path
      d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.521 2.522v6.312z"
      fill="#2EB67D"
    />
    <path
      d="M15.165 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.165 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.528 2.528 0 0 1-2.521-2.522 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z"
      fill="#ECB22E"
    />
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#5865F2">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const NotionIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.417 2.21c-.42-.326-.98-.7-2.055-.607L3.39 2.713c-.467.047-.56.28-.374.466l1.443 1.029zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.934-.56.934-1.166V6.354c0-.606-.233-.933-.747-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.747 0-.934-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.222-.186z" />
  </svg>
);

const JiraIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#0052CC">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005z" />
    <path
      d="M6.348 6.257H17.92a5.218 5.218 0 0 0-5.233-5.215h-2.13V-.015A5.218 5.218 0 0 0 5.343 5.253v11.457a1.005 1.005 0 0 0 1.005 1.005z"
      opacity=".65"
    />
  </svg>
);

const HubSpotIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#FF7A59">
    <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066A2.198 2.198 0 0 0 17.233.836h-.066a2.198 2.198 0 0 0-2.198 2.198v.066c0 .87.51 1.62 1.247 1.974v2.856a6.152 6.152 0 0 0-2.828 1.382l-7.476-5.822a2.467 2.467 0 0 0 .07-.57 2.478 2.478 0 1 0-2.479 2.478c.39 0 .756-.097 1.084-.261l7.37 5.74a6.158 6.158 0 0 0-.086 6.217l-2.191 2.191a2.08 2.08 0 0 0-.612-.1 2.094 2.094 0 1 0 2.094 2.094 2.08 2.08 0 0 0-.1-.612l2.153-2.153a6.19 6.19 0 1 0 4.922-10.34z" />
  </svg>
);

const PlugIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-8 h-8"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a6 6 0 0 1-12 0V8z" />
  </svg>
);

const INTEGRATION_ICONS: Record<string, () => JSX.Element> = {
  slack: SlackIcon,
  discord: DiscordIcon,
  notion: NotionIcon,
  jira: JiraIcon,
  hubspot: HubSpotIcon,
};

const ICON_BG: Record<string, string> = {
  slack: 'bg-[#4A154B]/10',
  discord: 'bg-[#5865F2]/10',
  notion: 'bg-gray-100 dark:bg-gray-700',
  jira: 'bg-[#0052CC]/10',
  hubspot: 'bg-[#FF7A59]/10',
};

const ZapIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const ListIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const PencilIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

function getStatus(integration: Integration): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  if (!integration.enabled) {
    return {
      label: 'Disabled',
      dotClass: 'bg-gray-400',
      textClass: 'text-gray-500 dark:text-gray-400',
    };
  }
  const isRecent = integration.lastSyncedAt
    ? Date.now() - new Date(integration.lastSyncedAt).getTime() < 3600000
    : false;
  if (isRecent) {
    return {
      label: 'Connected',
      dotClass: 'bg-green-500 animate-pulse',
      textClass: 'text-green-600 dark:text-green-400',
    };
  }
  return {
    label: 'Idle',
    dotClass: 'bg-yellow-500',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  };
}

function timeAgo(dateString?: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSuccessRate(integration: Integration): number | null {
  const total = integration._count?.syncLogs ?? 0;
  if (total === 0) return null;
  // Without detailed success/fail counts, we show total syncs as a proxy.
  // In a real scenario this would come from the API. For now, assume 94% default
  // or derive from available data. We return null when we can't compute.
  return null;
}

export function IntegrationCard({
  integration,
  onEdit,
  onDelete,
  onTest,
  onSync,
  onViewLogs,
}: IntegrationCardProps) {
  const IconComponent = INTEGRATION_ICONS[integration.type] || PlugIcon;
  const iconBg = ICON_BG[integration.type] || 'bg-gray-100 dark:bg-gray-700';
  const status = getStatus(integration);
  const totalSyncs = integration._count?.syncLogs ?? 0;
  const successRate = getSuccessRate(integration);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-600 hover:-translate-y-0.5 transition-all duration-300">
      {/* Header section */}
      <div className="p-5 pb-0">
        <div className="flex items-start gap-4">
          {/* Provider icon with colored background */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
            <IconComponent />
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {integration.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-400 dark:text-gray-500 capitalize">
                {integration.type}
              </span>
              <span className="text-gray-300 dark:text-gray-600">&middot;</span>
              <span className={`flex items-center gap-1.5 text-sm font-medium ${status.textClass}`}>
                <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats section */}
      <div className="px-5 py-4 mt-3 border-t border-gray-100 dark:border-gray-700/50">
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Last sync</span>
          <span className="text-right font-medium text-gray-900 dark:text-gray-100">
            {timeAgo(integration.lastSyncedAt)}
          </span>
          <span className="text-gray-500 dark:text-gray-400">Total syncs</span>
          <span className="text-right font-medium text-gray-900 dark:text-gray-100">
            {totalSyncs.toLocaleString()}
          </span>
        </div>

        {/* Success rate bar (shown only when we have data) */}
        {successRate !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Success rate</span>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                {successRate}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  successRate >= 90
                    ? 'bg-green-500'
                    : successRate >= 70
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions section */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        {/* Left actions: Test, Sync, Logs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTest(integration)}
            title="Test connection"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 transition-colors"
          >
            <ZapIcon />
          </button>
          <button
            onClick={() => onSync(integration)}
            title="Sync now"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={() => onViewLogs(integration)}
            title="View logs"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors"
          >
            <ListIcon />
          </button>
        </div>

        {/* Right actions: Edit, Delete */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(integration)}
            title="Edit integration"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => onDelete(integration)}
            title="Delete integration"
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
