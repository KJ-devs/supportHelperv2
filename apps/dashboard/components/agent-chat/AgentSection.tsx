'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { useAgentChatV2 } from '@/hooks/useAgentChatV2';
import { MarkdownRenderer } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { Diagnosis } from '@/components/diagnosis/DiagnosisPanelV3A';

type ActiveTab = 'chat' | 'logs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface TicketEvent {
  id: string;
  eventType: string;
  data: Record<string, any>;
  createdAt: string;
  status: 'done' | 'in_progress' | 'failed';
}

const EVENT_LABELS: Record<string, string> = {
  ticket_created: 'Ticket Created',
  ticket_updated: 'Ticket Updated',
  github_issue_created: 'GitHub Issue Created',
  agent_analysis_started: 'AI Analysis Started',
  agent_analysis_completed: 'Analysis Complete',
  agent_plan_ready: 'Action Plan Ready',
  agent_plan_approved: 'Plan Approved',
  agent_code_generation_started: 'Code Generation Started',
  agent_code_ready: 'Code Generated',
  agent_pr_created: 'Pull Request Created',
  agent_pr_updated: 'Pull Request Updated',
  ci_check_passed: 'CI Checks Passed',
  ci_check_failed: 'CI Check Failed',
  agent_retry: 'Agent Retrying',
  agent_failed: 'Agent Failed',
  agent_escalated: 'Escalated',
  fix_proposed: 'Fix Proposed',
};

const EVENT_DOT: Record<string, string> = {
  ticket_created: 'bg-green-400',
  ticket_updated: 'bg-blue-400',
  github_issue_created: 'bg-purple-400',
  agent_analysis_started: 'bg-cyan-400',
  agent_analysis_completed: 'bg-green-400',
  agent_plan_ready: 'bg-green-400',
  agent_plan_approved: 'bg-green-500',
  agent_code_generation_started: 'bg-blue-400',
  agent_code_ready: 'bg-green-400',
  agent_pr_created: 'bg-purple-400',
  agent_pr_updated: 'bg-purple-400',
  ci_check_passed: 'bg-green-400',
  ci_check_failed: 'bg-red-400',
  agent_retry: 'bg-yellow-400',
  agent_failed: 'bg-red-400',
  agent_escalated: 'bg-red-500',
  fix_proposed: 'bg-emerald-400',
};

function formatEventTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

interface AgentSectionProps {
  ticketId: string;
  onDiagnosisUpdate: () => void;
  diagnosis: Diagnosis | null;
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function AgentSection({ ticketId, onDiagnosisUpdate, diagnosis }: AgentSectionProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sessionId, isLoading, isAgentThinking, sendMessage, error, setError, reinitialize } =
    useAgentChatV2(ticketId);

  const lastUserMessageRef = useRef<string | null>(null);
  const toast = useToast();

  // Show a toast whenever a new error appears
  useEffect(() => {
    if (error) {
      toast.error('Agent error', error);
    }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const investigationLog = diagnosis?.investigationLog ?? [];

  // Ticket events (timeline) state
  const [ticketEvents, setTicketEvents] = useState<TicketEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchTicketEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}/timeline`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTicketEvents(data);
      }
    } catch {
      // silent
    } finally {
      setEventsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (activeTab === 'logs') fetchTicketEvents();
  }, [activeTab, fetchTicketEvents]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAgentThinking, activeTab]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isAgentThinking) return;
    lastUserMessageRef.current = content;
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(content);
    onDiagnosisUpdate();
  };

  const handleRetry = async () => {
    // If there was no session when error occurred, reinitialize from scratch
    if (!sessionId) {
      reinitialize();
      return;
    }
    // Otherwise re-send the last user message
    const lastMessage = lastUserMessageRef.current;
    if (lastMessage) {
      setError(null);
      await sendMessage(lastMessage);
      onDiagnosisUpdate();
    } else {
      // No message to retry — just clear the error
      setError(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const tabs = [
    { id: 'chat' as ActiveTab, label: 'Chat', icon: '💬' },
    { id: 'logs' as ActiveTab, label: 'Logs', icon: '🔍' },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar with icons */}
      <div className="flex items-center px-4 border-b border-gray-800 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-xs py-2.5 px-1 mr-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'text-white border-white'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}

        {/* Session indicator */}
        {sessionId && (
          <div className="ml-auto flex items-center gap-1.5" title={`Session: ${sessionId}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500">Session active</span>
          </div>
        )}
      </div>

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center h-32 gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                <span className="text-sm">Initializing session...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-400">
                <p className="leading-relaxed">{error}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleRetry}
                    disabled={isAgentThinking || isLoading}
                    className="flex items-center gap-1 px-2 py-1 bg-red-800/50 hover:bg-red-700/60 disabled:opacity-40 disabled:cursor-not-allowed rounded text-red-300 transition-colors"
                    aria-label="Retry"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    <span>Retry</span>
                  </button>
                  <button
                    onClick={() => setError(null)}
                    className="px-2 py-1 hover:bg-red-800/30 rounded text-red-500 hover:text-red-400 transition-colors"
                    aria-label="Dismiss error"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && messages.length === 0 && !isAgentThinking && (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm text-center px-4">
                Send a message to start the investigation.
              </div>
            )}

            {/* Messages with timestamps */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                  }`}
                >
                  <MarkdownRenderer content={msg.content} />
                  <span className="text-[10px] text-gray-400 mt-1 block opacity-70">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            ))}

            {/* Agent thinking */}
            {isAgentThinking && (
              <div className="flex mb-3 justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-gray-800">
                  <span className="text-sm text-gray-500 italic">Investigating</span>
                  <span className="inline-flex gap-0.5 ml-1.5">
                    <span
                      className="animate-bounce w-1 h-1 bg-gray-500 rounded-full"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="animate-bounce w-1 h-1 bg-gray-500 rounded-full"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="animate-bounce w-1 h-1 bg-gray-500 rounded-full"
                      style={{ animationDelay: '300ms' }}
                    />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input with character count */}
          <div className="flex-shrink-0 p-3 border-t border-gray-800">
            <div className="bg-gray-800 rounded-xl flex items-end gap-2 p-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                placeholder="Ask the agent..."
                rows={1}
                disabled={isAgentThinking || isLoading}
                className="bg-transparent text-sm text-gray-200 placeholder-gray-600 resize-none flex-1 border-0 focus:outline-none max-h-32 overflow-y-auto disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isAgentThinking || isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg p-2 flex-shrink-0 transition-colors"
                aria-label="Send"
              >
                <Send className="w-4 h-4 text-white" aria-hidden="true" />
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 px-1">
              {inputValue.length} chars · Enter ↵ to send
            </p>
          </div>
        </>
      )}

      {/* LOGS TAB — AI investigation + ticket events */}
      {activeTab === 'logs' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">

          {/* ── AI Investigation log ── */}
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
            AI Investigation
          </p>
          {investigationLog.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-3 mb-4">
              No investigation logs yet. Start a chat to begin analysis.
            </p>
          ) : (
            <div className="mb-4">
              {investigationLog.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                    {i < investigationLog.length - 1 && (
                      <div className="w-px flex-1 bg-gray-800 mt-1" />
                    )}
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gray-600">
                        {formatTime(entry.timestamp)}
                      </span>
                      <span className="text-xs font-medium text-blue-400">{entry.toolName}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Ticket Events ── */}
          <div className="border-t border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Ticket Events
              </p>
              <button
                onClick={fetchTicketEvents}
                disabled={eventsLoading}
                className="text-gray-600 hover:text-gray-400 disabled:opacity-40 transition-colors"
                aria-label="Refresh events"
              >
                <RefreshCw className={`w-3 h-3 ${eventsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {eventsLoading && ticketEvents.length === 0 && (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700 flex-shrink-0" />
                    <div className="h-2.5 bg-gray-800 rounded flex-1" />
                    <div className="h-2.5 bg-gray-800 rounded w-8" />
                  </div>
                ))}
              </div>
            )}

            {!eventsLoading && ticketEvents.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-3">No events yet.</p>
            )}

            {ticketEvents.length > 0 && (
              <div className="space-y-0">
                {ticketEvents.map((evt) => {
                  const dotColor = EVENT_DOT[evt.eventType] ?? 'bg-gray-500';
                  const label = EVENT_LABELS[evt.eventType] ?? evt.eventType.replace(/_/g, ' ');
                  const isFailed = evt.status === 'failed';
                  const isInProgress = evt.status === 'in_progress';
                  return (
                    <div
                      key={evt.id}
                      className={`flex items-center gap-2 py-1.5 border-b border-gray-800/50 last:border-0 ${isFailed ? 'opacity-75' : ''}`}
                    >
                      {isInProgress ? (
                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
                        </span>
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                      )}
                      <span className={`text-xs flex-1 truncate ${isFailed ? 'text-red-400' : isInProgress ? 'text-blue-400' : 'text-gray-400'}`}>
                        {label}
                      </span>
                      <span className="text-[10px] font-mono text-gray-600 flex-shrink-0">
                        {formatEventTime(evt.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
