'use client';

import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2', className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
        <span className="text-xs text-muted-foreground">Agent is analyzing</span>
        <span className="flex items-center gap-0.5">
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: '0ms', animationDuration: '1s' }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: '200ms', animationDuration: '1s' }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: '400ms', animationDuration: '1s' }}
          />
        </span>
      </div>
    </div>
  );
}
