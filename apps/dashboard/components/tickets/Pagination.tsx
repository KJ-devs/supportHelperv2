/**
 * Pagination Component
 * Navigation entre les pages
 */

'use client';

import { useTranslations } from 'next-intl';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const t = useTranslations('pagination');

  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Show max 7 pages with ellipsis
  let visiblePages = pages;
  if (totalPages > 7) {
    if (currentPage <= 4) {
      visiblePages = [...pages.slice(0, 5), -1, totalPages];
    } else if (currentPage >= totalPages - 3) {
      visiblePages = [1, -1, ...pages.slice(totalPages - 5)];
    } else {
      visiblePages = [1, -1, currentPage - 1, currentPage, currentPage + 1, -1, totalPages];
    }
  }

  return (
    <nav
      className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t dark:border-gray-700 sm:px-6"
      role="navigation"
      aria-label="Pagination"
    >
      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            {t('page', { current: currentPage, total: totalPages })}
          </p>
        </div>

        <div className="flex space-x-2">
          {/* Previous Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t('previous')}
          >
            ← {t('previous')}
          </button>

          {/* Page Numbers */}
          <div className="hidden md:flex space-x-1" role="group" aria-label="Pagination">
            {visiblePages.map((page, index) => {
              if (page === -1) {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  aria-label={`Page ${page}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>

          {/* Next Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t('next')}
          >
            {t('next')} →
          </button>
        </div>
      </div>
    </nav>
  );
}
