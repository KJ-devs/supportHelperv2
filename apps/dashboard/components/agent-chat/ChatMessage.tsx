'use client';

import type { AgentMessageRecord } from '@/lib/api/agent-v2';
import { ToolCallBadge } from './ToolCallBadge';

interface ChatMessageProps {
  message: AgentMessageRecord;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const formattedTime = (() => {
    try {
      const date = new Date(message.createdAt);
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
  })();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start max-w-[78%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            isUser ? 'bg-blue-600 ml-3' : 'bg-gray-600 mr-3'
          }`}
        >
          {isUser ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 7H7v6h6V7z" />
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Bubble + tools */}
        <div className={isUser ? 'items-end' : 'items-start'} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
            }`}
          >
            {message.content}
          </div>

          {/* Tool call badges (assistant only) */}
          {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {message.toolsUsed.map((tool, i) => (
                <ToolCallBadge key={i} toolName={tool} />
              ))}
            </div>
          )}

          <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {formattedTime}
          </p>
        </div>
      </div>
    </div>
  );
}
