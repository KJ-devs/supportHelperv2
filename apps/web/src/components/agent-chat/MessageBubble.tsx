'use client';

import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { DiagnosisCard } from './DiagnosisCard';
import { ActionPlanCard } from './ActionPlanCard';
import { PrStatusCard } from './PrStatusCard';
import type { AgentMessage } from './useAgentChat';

interface MessageBubbleProps {
  message: AgentMessage;
  onApprove: (messageId: string) => Promise<void>;
  onReject: (messageId: string) => Promise<void>;
}

export function MessageBubble({ message, onApprove, onReject }: MessageBubbleProps) {
  const { type, content, sender, createdAt } = message;

  // System message - centered, subtle
  if (type === 'system') {
    return (
      <div className="flex justify-center px-4 py-1">
        <p className="text-center text-xs italic text-muted-foreground">{content}</p>
      </div>
    );
  }

  // Rich card types - full width, left-aligned
  if (type === 'diagnosis') {
    return (
      <div className="px-4 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{sender}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</span>
        </div>
        <DiagnosisCard message={message} />
      </div>
    );
  }

  if (type === 'action_plan') {
    return (
      <div className="px-4 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{sender}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</span>
        </div>
        <ActionPlanCard message={message} onApprove={onApprove} onReject={onReject} />
      </div>
    );
  }

  if (type === 'pr_status') {
    return (
      <div className="px-4 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{sender}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</span>
        </div>
        <PrStatusCard message={message} />
      </div>
    );
  }

  // User message - right aligned, blue bubble
  if (type === 'user') {
    return (
      <div className="flex justify-end gap-2 px-4 py-1">
        <div className="flex max-w-[75%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
            <p className="text-sm leading-relaxed">{content}</p>
          </div>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</span>
        </div>
        <Avatar className="h-8 w-8 shrink-0 self-end">
          <AvatarFallback className="bg-primary/10 text-xs">
            <User className="h-4 w-4 text-primary" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // Agent text message - left aligned with Bot avatar
  return (
    <div className="flex gap-2 px-4 py-1">
      <Avatar className="h-8 w-8 shrink-0 self-end">
        <AvatarFallback className="bg-primary/10 text-xs">
          <Bot className="h-4 w-4 text-primary" />
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          'flex max-w-[75%] flex-col items-start gap-1'
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{sender}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}
