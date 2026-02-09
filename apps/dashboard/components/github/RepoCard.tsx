'use client';

import { Card } from '@/components/ui';

interface RepoCardProps {
  fullName: string;
  description?: string;
  stars: number;
  issues: number;
  isPrivate: boolean;
  url: string;
  updatedAt: string;
}

export function RepoCard({
  fullName,
  description,
  stars,
  issues,
  isPrivate,
  url,
  updatedAt,
}: RepoCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-semibold text-base truncate block"
            >
              {fullName}
            </a>
          </div>
          {isPrivate && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              Private
            </span>
          )}
        </div>

        {description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {description}
          </p>
        )}
        {!description && (
          <p className="text-sm text-gray-400 italic mb-3">No description</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1" title="Stars">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>{stars}</span>
          </span>
          <span className="flex items-center space-x-1" title="Open issues">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{issues}</span>
          </span>
        </div>
        <span className="text-xs text-gray-400" title="Last updated">
          Updated{' '}
          {new Date(updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </Card>
  );
}
