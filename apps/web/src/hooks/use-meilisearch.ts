'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TicketFilters, SearchResult } from './use-tickets-advanced';

const API_BASE = '/api';

interface UseMeilisearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  typoTolerance?: boolean;
  facets?: string[];
}

interface MeilisearchState {
  query: string;
  results: SearchResult | null;
  isLoading: boolean;
  error: Error | null;
}

export function useMeilisearch(filters: TicketFilters = {}, options: UseMeilisearchOptions = {}) {
  const { debounceMs = 300, minQueryLength = 2 } = options;

  const [state, setState] = useState<MeilisearchState>({
    query: '',
    results: null,
    isLoading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(
    async (searchQuery: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Update query immediately
      setState(prev => ({ ...prev, query: searchQuery }));

      // Check minimum length
      if (searchQuery.length < minQueryLength) {
        setState(prev => ({
          ...prev,
          results: null,
          isLoading: false,
          error: null,
        }));
        return;
      }

      // Debounce the actual search
      debounceTimerRef.current = setTimeout(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        abortControllerRef.current = new AbortController();

        try {
          const params = new URLSearchParams();
          params.set('q', searchQuery);
          if (filters.status && filters.status !== 'all') {
            params.set('status', filters.status);
          }
          if (filters.priority && filters.priority !== 'all') {
            params.set('priority', filters.priority);
          }
          if (filters.type && filters.type !== 'all') {
            params.set('type', filters.type);
          }

          const response = await fetch(`${API_BASE}/tickets/search?${params.toString()}`, {
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            throw new Error('Search failed');
          }

          const data: SearchResult = await response.json();

          setState(prev => ({
            ...prev,
            results: data,
            isLoading: false,
          }));
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return; // Ignore abort errors
          }

          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error : new Error('Search failed'),
            isLoading: false,
          }));
        }
      }, debounceMs);
    },
    [filters, debounceMs, minQueryLength]
  );

  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      query: '',
      results: null,
      isLoading: false,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    search,
    clearSearch,
  };
}

// Specialized hook for ticket suggestions
export function useTicketSuggestions(query: string, limit = 5) {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      abortRef.current = new AbortController();

      try {
        const response = await fetch(
          `${API_BASE}/tickets/suggest?q=${encodeURIComponent(query)}&limit=${limit}`,
          { signal: abortRef.current.signal }
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch {
        // Ignore errors for suggestions
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, limit]);

  return { suggestions, isLoading };
}
