'use client';

import { Bot } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAgentChat } from './useAgentChat';
import { MessageList } from './MessageList';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ChatInput } from './ChatInput';

interface AgentChatPanelProps {
  ticketId: string;
  agentTaskId?: string;
  apiUrl?: string;
  className?: string;
}

const taskStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-yellow-200 bg-yellow-100 text-yellow-700' },
  running: { label: 'Running', className: 'border-blue-200 bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'border-green-200 bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'border-red-200 bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'border-muted bg-muted text-muted-foreground' },
};

export function AgentChatPanel({
  ticketId,
  agentTaskId,
  apiUrl,
  className,
}: AgentChatPanelProps) {
  const { messages, isLoading, isAgentThinking, taskStatus, sendMessage, approveAction, rejectAction } =
    useAgentChat({ ticketId, agentTaskId, apiUrl });

  const statusCfg = taskStatus ? (taskStatusConfig[taskStatus] ?? null) : null;
  const isCompleted = taskStatus === 'completed' || taskStatus === 'failed';

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-lg border bg-background shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Agent</h3>
            <p className="text-xs text-muted-foreground">Ticket #{ticketId.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusCfg && (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                statusCfg.className
              )}
            >
              {statusCfg.label}
            </span>
          )}
          {isAgentThinking ? (
            <span className="flex h-2 w-2 rounded-full bg-blue-500 ring-2 ring-blue-200" />
          ) : (
            <span className="flex h-2 w-2 rounded-full bg-green-500 ring-2 ring-green-200" />
          )}
        </div>
      </div>

      <Separator />

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onApprove={approveAction}
        onReject={rejectAction}
      />

      {/* Thinking indicator */}
      {isAgentThinking && (
        <>
          <Separator />
          <ThinkingIndicator />
        </>
      )}

      <Separator />

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isAgentThinking || isCompleted}
        placeholder={
          isCompleted
            ? 'This task has ended.'
            : 'Ask the agent anything about this ticket... (Ctrl+Enter to send)'
        }
      />
    </div>
  );
}
