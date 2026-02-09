'use client';

interface ChatMessageProps {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isAgent = role === 'agent';
  const formattedTime = formatTimestamp(timestamp);

  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`flex items-start max-w-[75%] ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            isAgent ? 'bg-gray-600 mr-3' : 'bg-blue-600 ml-3'
          }`}
        >
          {isAgent ? (
            <AgentIcon />
          ) : (
            <UserIcon />
          )}
        </div>

        {/* Message bubble */}
        <div>
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isAgent
                ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                : 'bg-blue-600 text-white rounded-tr-sm'
            }`}
          >
            {content}
          </div>
          <p
            className={`text-xs text-gray-400 mt-1 ${
              isAgent ? 'text-left' : 'text-right'
            }`}
          >
            {formattedTime}
          </p>
        </div>
      </div>
    </div>
  );
}

function AgentIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M13 7H7v6h6V7z" />
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
