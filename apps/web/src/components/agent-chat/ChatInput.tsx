'use client';

import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask the agent anything about this ticket... (Ctrl+Enter to send)',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSend(trimmed);
      setValue('');
      textareaRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <div className="flex items-end gap-2 border-t bg-background p-4">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        rows={3}
        className={cn(
          'min-h-[80px] resize-none flex-1 transition-opacity',
          isDisabled && 'opacity-60'
        )}
      />
      <Button
        onClick={handleSend}
        disabled={isDisabled || !value.trim()}
        size="icon"
        className="mb-0.5 h-10 w-10 shrink-0"
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
