'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useAgentChatV2 } from '@/hooks/useAgentChatV2';
import { ChatMessage } from './ChatMessage';
import { ToolCallBadge } from './ToolCallBadge';

interface AgentChatV2Props {
  ticketId: string;
  onClose?: () => void;
  onDiagnosisUpdate?: () => void;
}

export function AgentChatV2({ ticketId, onClose, onDiagnosisUpdate }: AgentChatV2Props) {
  const { messages, sessionId, isLoading, isAgentThinking, sendMessage, toolActivity, error } =
    useAgentChatV2(ticketId);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentThinking]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isAgentThinking) return;
    setInputValue('');
    await sendMessage(content);
    onDiagnosisUpdate?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-96 border dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm">Initializing agent session...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col border dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          🤖 Agent Chat
        </span>
        {sessionId ? (
          <span className="flex items-center gap-1.5" title={`Session: ${sessionId}`}>
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-gray-400 font-mono">{sessionId.slice(0, 8)}</span>
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
        )}
        <span className="ml-auto text-xs text-gray-400">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-64 max-h-[600px]">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {messages.length === 0 && isAgentThinking && (
          <div className="flex items-center justify-center h-32 gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            <span>Analyzing ticket...</span>
          </div>
        )}

        {messages.length === 0 && !isAgentThinking && (
          <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
            Send a message to start the investigation.
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Agent thinking indicator */}
        {isAgentThinking && (
          <div className="flex justify-start mb-4">
            <div className="flex items-start gap-3 max-w-[78%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 7H7v6h6V7z" />
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="space-y-1.5">
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm">
                  <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Agent is investigating...
                  </span>
                  <span className="inline-flex gap-0.5 ml-2">
                    <span className="animate-bounce w-1 h-1 bg-gray-400 rounded-full" style={{ animationDelay: '0ms' }} />
                    <span className="animate-bounce w-1 h-1 bg-gray-400 rounded-full" style={{ animationDelay: '150ms' }} />
                    <span className="animate-bounce w-1 h-1 bg-gray-400 rounded-full" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
                {toolActivity.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {toolActivity.map((tool, i) => (
                      <ToolCallBadge key={i} toolName={tool} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t dark:border-gray-700 p-3 bg-white dark:bg-gray-900">
        <div className="flex gap-2 items-end">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent... (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isAgentThinking}
            className="flex-1 resize-none px-3 py-2 text-sm border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isAgentThinking}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
