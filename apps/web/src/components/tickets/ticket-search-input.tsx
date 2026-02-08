'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function TicketSearchInput({
  value,
  onChange,
  isLoading = false,
  placeholder = 'Search tickets...',
  className,
  debounceMs = 300,
}: TicketSearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync external value
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : localValue ? (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleClear}>
            <X className="h-3 w-3" />
            <span className="sr-only">Clear search</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// Search with suggestions
interface SearchSuggestion {
  id: string;
  title: string;
}

interface TicketSearchWithSuggestionsProps extends TicketSearchInputProps {
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  showSuggestions?: boolean;
}

export function TicketSearchWithSuggestions({
  suggestions = [],
  onSuggestionSelect,
  showSuggestions = true,
  ...props
}: TicketSearchWithSuggestionsProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const shouldShowSuggestions =
    showSuggestions && isFocused && props.value.length >= 2 && suggestions.length > 0;

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div onFocus={() => setIsFocused(true)}>
        <TicketSearchInput {...props} />
      </div>

      {shouldShowSuggestions && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map(suggestion => (
            <button
              key={suggestion.id}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onSuggestionSelect?.(suggestion);
                setIsFocused(false);
              }}
            >
              <Search className="mr-2 h-3 w-3 text-muted-foreground" />
              <span className="truncate">{suggestion.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
