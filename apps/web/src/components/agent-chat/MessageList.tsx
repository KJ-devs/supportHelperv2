'use client';

import { useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageBubble } from './MessageBubble';
import type { AgentMessage } from './useAgentChat';

interface MessageListProps {
  messages: AgentMessage[];
  isLoading: boolean;
  onApprove: (messageId: string) => Promise<void>;
  onReject: (messageId: string) => Promise<void>;
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48 rounded-lg" />
          <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <div className="space-y-2">
          <Skeleton className="ml-auto h-10 w-52 rounded-2xl rounded-tr-sm" />
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        <Skeleton className="h-24 w-72 rounded-2xl rounded-tl-sm" />
      </div>
    </div>
  );
}

export function MessageList({ messages, isLoading, onApprove, onReject }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <MessageSkeleton />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Send a message to start the conversation with the agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      <div className="space-y-1">
        {messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
