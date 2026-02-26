'use client';

import { Bot } from 'lucide-react';
import { Card } from '@/components/ui';

export interface AffectedFile {
  filePath: string;
  relevance: 'primary' | 'secondary' | 'context';
  description: string;
  codeSnippet?: string;
}

export interface Diagnosis {
  rootCause: string;
  affectedFiles: AffectedFile[];
  confidence: number;
  suggestedFix?: string;
  remainingQuestions?: string[];
  investigationLog?: Array<{ toolName: string; summary: string; timestamp: string }>;
}

interface DiagnosisPanelProps {
  ticketId: string;
  diagnosis: Diagnosis | null;
  isLoading: boolean;
  onAskAgent?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  const percent = Math.round(normalized * 100);

  if (normalized >= 0.8) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        {percent}% confidence
      </span>
    );
  }
  if (normalized >= 0.5) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        {percent}% confidence
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
      {percent}% confidence
    </span>
  );
}

function RelevanceIcon({ relevance }: { relevance: AffectedFile['relevance'] }) {
  if (relevance === 'primary') return <span title="Primary">🔴</span>;
  if (relevance === 'secondary') return <span title="Secondary">🟡</span>;
  return <span title="Context">⚪</span>;
}

function DiagnosisSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

export function DiagnosisPanel({ ticketId: _ticketId, diagnosis, isLoading, onAskAgent }: DiagnosisPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🔬 Diagnosis
        </h2>
        <DiagnosisSkeleton />
      </Card>
    );
  }

  if (!diagnosis) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mb-1">No diagnosis yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mb-4 max-w-xs mx-auto">
            The AI agent will automatically analyze this ticket when you open the chat.
          </p>
          {onAskAgent && (
            <button
              onClick={onAskAgent}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Bot className="w-4 h-4" />
              Start Analysis
            </button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            🔬 Diagnosis
          </h2>
          <ConfidenceBadge confidence={diagnosis.confidence} />
        </div>

        {/* Root Cause */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Root Cause
          </h3>
          <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            {diagnosis.rootCause}
          </p>
        </div>

        {/* Affected Files */}
        {diagnosis.affectedFiles?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Affected Files
            </h3>
            <div className="space-y-3">
              {diagnosis.affectedFiles?.map((file, index) => (
                <div
                  key={index}
                  className="border dark:border-gray-700 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <RelevanceIcon relevance={file.relevance} />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">
                        {file.filePath}
                      </code>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {file.description}
                      </p>
                    </div>
                  </div>
                  {file.codeSnippet && (
                    <pre className="overflow-x-auto rounded bg-gray-900 p-3">
                      <code className="text-sm text-gray-100">{file.codeSnippet}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Fix */}
        {diagnosis.suggestedFix && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
              Suggested Fix
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {diagnosis.suggestedFix}
            </p>
          </div>
        )}

        {/* Remaining Questions */}
        {diagnosis.remainingQuestions && diagnosis.remainingQuestions.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
              Remaining Questions
            </h3>
            <ul className="space-y-1">
              {diagnosis.remainingQuestions.map((question, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                  <span className="mt-0.5">•</span>
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            🤖 Generate Fix
          </button>
          {onAskAgent && (
            <button
              onClick={onAskAgent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              💬 Ask Agent
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
