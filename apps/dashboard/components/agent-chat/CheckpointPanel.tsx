'use client';

import { useState } from 'react';

export interface CheckpointData {
  checkpointType: 'analysis_complete' | 'pr_ready';
  summary: string;
  proposedNextSteps?: string[];
  proposedChanges?: string[];
  message: string;
}

interface Props {
  checkpoint: CheckpointData;
  onApprove: (guidance?: string) => Promise<void>;
  onRequestPR: (instructions?: string) => Promise<void>;
  onGuide: (message: string) => void;
  isLoading?: boolean;
}

export function CheckpointPanel({ checkpoint, onApprove, onRequestPR, onGuide, isLoading }: Props) {
  const [textValue, setTextValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAnalysis = checkpoint.checkpointType === 'analysis_complete';

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(textValue.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestPR = async () => {
    setIsSubmitting(true);
    try {
      await onRequestPR(textValue.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuide = () => {
    const text = textValue.trim();
    if (!text) return;
    onGuide(text);
    setTextValue('');
  };

  const busy = isLoading || isSubmitting;

  if (isAnalysis) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-amber-700/50 bg-amber-950/30 shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/20 rounded-t-xl border-b border-amber-700/30">
          <span className="text-sm">&#128269;</span>
          <span className="text-xs font-semibold text-amber-300">
            Analysis Complete &mdash; Awaiting your review
          </span>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Summary */}
          <p className="text-xs text-gray-300 leading-relaxed">{checkpoint.summary}</p>

          {/* Proposed next steps */}
          {checkpoint.proposedNextSteps && checkpoint.proposedNextSteps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1.5">
                Proposed Next Steps
              </p>
              <ul className="space-y-1">
                {checkpoint.proposedNextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Guidance textarea */}
          <textarea
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            disabled={busy}
            placeholder="Add specific instructions for the agent..."
            rows={2}
            className="w-full text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/60 disabled:opacity-40"
          />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-colors"
            >
              {isSubmitting ? (
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <span>&#9654;</span>
              )}
              Approve &amp; Proceed
            </button>
            <button
              onClick={handleGuide}
              disabled={busy || !textValue.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-gray-300 transition-colors"
            >
              <span>&#9998;</span>
              Guide only
            </button>
          </div>
        </div>
      </div>
    );
  }

  // pr_ready
  return (
    <div className="mx-4 mb-3 rounded-xl border border-green-700/50 bg-green-950/20 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-900/20 rounded-t-xl border-b border-green-700/30">
        <span className="text-sm">&#10003;</span>
        <span className="text-xs font-semibold text-green-300">Ready to Create PR</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Summary */}
        <p className="text-xs text-gray-300 leading-relaxed">{checkpoint.summary}</p>

        {/* Proposed changes */}
        {checkpoint.proposedChanges && checkpoint.proposedChanges.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-green-400 uppercase tracking-widest mb-1.5">
              Files to be Modified
            </p>
            <ul className="space-y-1">
              {checkpoint.proposedChanges.map((file, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-400 font-mono">
                  <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span>{file}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PR instructions textarea */}
        <textarea
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          disabled={busy}
          placeholder="Add notes for the PR description..."
          rows={2}
          className="w-full text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-green-500/60 disabled:opacity-40"
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRequestPR}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-white transition-colors"
          >
            {isSubmitting ? (
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <span>&#128640;</span>
            )}
            Create Pull Request
          </button>
          <button
            onClick={handleGuide}
            disabled={busy || !textValue.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-gray-300 transition-colors"
          >
            <span>&#9998;</span>
            Give more guidance
          </button>
        </div>
      </div>
    </div>
  );
}
