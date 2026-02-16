/**
 * Global Search Component
 * Recherche globale dans le header avec résultats instantanés
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ticketsApi } from '@/lib/api/tickets';
import type { Ticket } from '@/lib/types/ticket';
import { StatusBadge, SeverityBadge } from '@/components/ui';

export function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search debounced
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await ticketsApi.getTickets({
          search: query,
          limit: 5,
        });
        setResults(response.data);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (ticketId: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(`/dashboard/tickets/${ticketId}`);
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push(`/dashboard/tickets?search=${encodeURIComponent(query)}`);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative" role="search">
        <label htmlFor="global-search" className="sr-only">
          Rechercher dans les tickets
        </label>
        <input
          id="global-search"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher... (Ctrl+K)"
          className="w-full px-4 py-2 pl-10 pr-10 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px]"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Effacer la recherche"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
            </svg>
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && query && (
        <div className="fixed sm:absolute inset-0 sm:inset-auto sm:top-full sm:left-0 sm:right-0 sm:mt-2 sm:w-96 bg-white dark:bg-gray-900 sm:rounded-lg sm:shadow-xl sm:border border-gray-200 dark:border-gray-700 z-50 overflow-y-auto sm:max-h-96">
          {/* Loading */}
          {isLoading && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400" role="status" aria-live="polite">
              <svg
                className="animate-spin h-5 w-5 mx-auto mb-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm">Recherche en cours...</p>
            </div>
          )}

          {/* No Results */}
          {!isLoading && results.length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">Aucun résultat pour &quot;{query}&quot;</p>
            </div>
          )}

          {/* Results List */}
          {!isLoading && results.length > 0 && (
            <>
              <div className="p-2" role="list">
                {results.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelect(ticket.id)}
                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    role="option"
                    aria-label={`Ticket: ${ticket.title}, ${ticket.severity}, ${ticket.status}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                        {ticket.title}
                      </h4>
                      <SeverityBadge severity={ticket.severity} />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      {ticket.application && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {ticket.application.name}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* View All Link */}
              <div className="border-t dark:border-gray-700 p-3">
                <button
                  onClick={handleViewAll}
                  className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Voir tous les résultats pour &quot;{query}&quot; →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
