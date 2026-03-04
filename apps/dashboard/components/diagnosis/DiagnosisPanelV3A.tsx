'use client';

import { useState } from 'react';
import { Bot, ChevronUp, ChevronDown } from 'lucide-react';
import type { Diagnosis, AffectedFile } from '@/lib/api/agent-v2';

export type { Diagnosis };

interface DiagnosisPanelV3AProps {
  diagnosis: Diagnosis | null;
  isLoading: boolean;
}

// --- Confidence dot color ---

function confidenceColor(confidence: number): string {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  if (normalized >= 0.8) return 'text-green-400';
  if (normalized >= 0.5) return 'text-yellow-400';
  return 'text-red-400';
}

function confidencePercent(confidence: number): number {
  return Math.round(confidence > 1 ? confidence : confidence * 100);
}

// --- File row ---

function FileRow({ file }: { file: AffectedFile }) {
  const borderClass =
    file.relevance === 'primary'
      ? 'border-red-500'
      : file.relevance === 'secondary'
        ? 'border-yellow-500'
        : 'border-gray-600';

  const shortName = file.filePath.split('/').pop() ?? file.filePath;

  return (
    <div className={`border-l-2 ${borderClass} pl-2`} title={file.filePath}>
      <span className="text-xs font-mono text-gray-400">{shortName}</span>
      {file.description && (
        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{file.description}</p>
      )}
    </div>
  );
}

// --- Skeleton (dark) ---

function DiagnosisSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-gray-700" />
        <div className="h-3 w-28 bg-gray-700 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-700 rounded w-4/5" />
        <div className="h-3 bg-gray-700 rounded w-3/5" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-24 bg-gray-700 rounded" />
        <div className="h-3 w-32 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

// --- Main component ---

export function DiagnosisPanelV3A({ diagnosis, isLoading }: DiagnosisPanelV3AProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div>
        {/* Header with toggle (skeleton state) */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-widest text-gray-500 uppercase font-medium">
            AI Diagnosis
          </p>
          <button
            disabled
            className="flex items-center gap-1 text-gray-600 opacity-50"
            aria-label="Toggle diagnosis"
          >
            <span className="text-[10px] text-gray-600">collapse</span>
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
        <DiagnosisSkeleton />
      </div>
    );
  }

  if (!diagnosis) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] tracking-widest text-gray-500 uppercase font-medium">
            AI Diagnosis
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <Bot className="w-7 h-7 text-gray-600" aria-hidden="true" />
          <p className="text-gray-400 text-sm">No diagnosis</p>
          <p className="text-gray-600 text-xs">Chat below to analyze</p>
        </div>
      </div>
    );
  }

  const dotColor = confidenceColor(diagnosis.confidence);
  const percent = confidencePercent(diagnosis.confidence);

  return (
    <div>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] tracking-widest text-gray-500 uppercase font-medium">
          AI Diagnosis
        </p>
        <button
          onClick={() => setIsExpanded(v => !v)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label={isExpanded ? 'Collapse diagnosis' : 'Expand diagnosis'}
        >
          <span className="text-[10px]">{isExpanded ? 'collapse' : 'expand'}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Collapsed: one-line summary */}
      {!isExpanded && (
        <div className="flex items-center gap-2">
          <span className={`text-base leading-none ${dotColor}`}>●</span>
          <span className="text-sm text-gray-200">{percent}% confident</span>
        </div>
      )}

      {/* Expanded: full diagnosis */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Confidence row */}
          <div className="flex items-center gap-2">
            <span className={`text-lg leading-none ${dotColor}`}>●</span>
            <span className="text-sm text-gray-200">{percent}% confident</span>
            <span className="text-xs text-gray-500">in root cause</span>
          </div>

          {/* Root cause */}
          <p className="text-sm text-gray-300 leading-relaxed">{diagnosis.rootCause}</p>

          {/* Affected files */}
          {diagnosis.affectedFiles?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {diagnosis.affectedFiles.map((file, i) => (
                <FileRow key={i} file={file} />
              ))}
            </div>
          )}

          {/* Suggested fix */}
          {diagnosis.suggestedFix && (
            <div className="mt-3 bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-300 leading-relaxed">{diagnosis.suggestedFix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
