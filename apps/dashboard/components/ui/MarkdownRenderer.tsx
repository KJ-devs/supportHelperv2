'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-1 first:mt-0">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2 mb-1 first:mt-0">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 mb-1 first:mt-0">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2 last:mb-0">
      {children}
    </p>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className={`${className ?? ''} text-xs text-gray-100`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono my-3 leading-relaxed">
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 mb-2 pl-2">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 mb-2 pl-2">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-400 dark:border-blue-600 pl-4 py-1 my-2 bg-blue-50 dark:bg-blue-900/20 rounded-r text-sm text-gray-700 dark:text-gray-300 italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr className="border-gray-200 dark:border-gray-700 my-4" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-sm border-collapse border border-gray-200 dark:border-gray-700 rounded">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-xs">
      {children}
    </td>
  ),
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
