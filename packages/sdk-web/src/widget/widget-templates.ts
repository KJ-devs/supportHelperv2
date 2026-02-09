/**
 * Widget Templates - Pure functions returning HTML for each view
 */

import type { WidgetState, ReportResponse } from './widget-types';

/**
 * SVG Icons
 */
const ICONS = {
  help: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`,
  
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`,
  
  video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,
  
  play: `<svg viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`,
  
  stop: `<svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>`,
  
  pause: `<svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>`,
  
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,
  
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>`,
  
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>`,
  
  alertCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`,
  
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>`,

  film: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
    <line x1="7" y1="2" x2="7" y2="22"/>
    <line x1="17" y1="2" x2="17" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="7" x2="7" y2="7"/>
    <line x1="2" y1="17" x2="7" y2="17"/>
    <line x1="17" y1="17" x2="22" y2="17"/>
    <line x1="17" y1="7" x2="22" y2="7"/>
  </svg>`,
};

/**
 * Floating Action Button
 */
export function renderFAB(tooltip: string): string {
  return `
    <button class="sh-fab" title="${escapeHtml(tooltip)}" data-action="open">
      ${ICONS.help}
    </button>
  `;
}

/**
 * Modal shell with header
 */
export function renderModal(title: string, bodyContent: string): string {
  return `
    <div class="sh-backdrop" data-action="close"></div>
    <div class="sh-modal" role="dialog" aria-modal="true" aria-labelledby="sh-modal-title">
      <div class="sh-modal-header">
        <h2 class="sh-modal-title" id="sh-modal-title">${escapeHtml(title)}</h2>
        <button class="sh-close-btn" data-action="close" aria-label="Close">
          ${ICONS.close}
        </button>
      </div>
      <div class="sh-modal-body">
        ${bodyContent}
      </div>
    </div>
  `;
}

/**
 * Open view - Start recording button
 */
export function renderOpenView(): string {
  return `
    <div class="sh-view sh-view-center">
      <div class="sh-start-icon">
        ${ICONS.video}
      </div>
      <div class="sh-title">Record your issue</div>
      <p class="sh-message">
        Share your screen to capture exactly what went wrong. 
        We'll analyze the video to help resolve your issue faster.
      </p>
      <button class="sh-btn sh-btn-primary sh-btn-block" data-action="start">
        ${ICONS.video}
        <span>Start Recording</span>
      </button>
    </div>
  `;
}

/**
 * Recording view - Timer + stop button (used inside modal for non-recording states)
 */
export function renderRecordingView(elapsedSeconds: number, isPaused: boolean): string {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return `
    <div class="sh-view sh-view-center">
      <div class="sh-timer">
        <div class="sh-timer-dot ${isPaused ? 'paused' : ''}"></div>
        <div class="sh-timer-time">${timeStr}</div>
      </div>
      <p class="sh-message">
        ${isPaused ? 'Recording paused' : 'Recording your screen...'}
      </p>
      <div class="sh-btn-group">
        <button class="sh-btn sh-btn-secondary" data-action="${isPaused ? 'resume' : 'pause'}">
          ${isPaused ? ICONS.play : ICONS.pause}
          <span>${isPaused ? 'Resume' : 'Pause'}</span>
        </button>
        <button class="sh-btn sh-btn-danger" data-action="stop">
          ${ICONS.stop}
          <span>Stop</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Minimal floating recording bar - shown during recording instead of modal
 * No backdrop/overlay so the page is fully visible and capturable
 */
export function renderRecordingBar(elapsedSeconds: number, isPaused: boolean): string {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return `
    <div class="sh-recording-bar">
      <span class="sh-rec-dot ${isPaused ? 'paused' : ''}"></span>
      <span class="sh-rec-time sh-timer-time">${timeStr}</span>
      <button data-action="${isPaused ? 'resume' : 'pause'}">
        ${isPaused ? 'Resume' : 'Pause'}
      </button>
      <button class="sh-rec-stop" data-action="stop">
        Stop
      </button>
    </div>
  `;
}

/**
 * Preview view - Video player + accept/re-record
 */
export function renderPreviewView(videoUrl: string, duration: number, size: number): string {
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const sizeStr = formatFileSize(size);
  
  return `
    <div class="sh-view">
      <div class="sh-video-container">
        <video class="sh-video" src="${videoUrl}" controls></video>
      </div>
      <div class="sh-video-info">
        <span>Duration: ${timeStr}</span>
        <span>Size: ${sizeStr}</span>
      </div>
      <div class="sh-btn-group">
        <button class="sh-btn sh-btn-secondary" data-action="re-record">
          ${ICONS.refresh}
          <span>Record again</span>
        </button>
        <button class="sh-btn sh-btn-primary" data-action="accept">
          ${ICONS.check}
          <span>Use this video</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Editing view - Form with title, description, video thumbnail
 */
export function renderEditingView(videoUrl: string, duration: number): string {
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  
  return `
    <div class="sh-view">
      <form class="sh-form" data-form="report">
        <div class="sh-video-thumb">
          <video src="${videoUrl}" muted></video>
          <div class="sh-video-thumb-overlay">
            ${ICONS.film}
            <span>${timeStr} video attached</span>
          </div>
        </div>
        <input 
          type="text" 
          class="sh-input" 
          name="title" 
          placeholder="Brief title for your issue..."
          required
          maxlength="200"
        />
        <textarea 
          class="sh-textarea" 
          name="description" 
          placeholder="Describe what happened..."
          required
          maxlength="2000"
        ></textarea>
        <button type="submit" class="sh-btn sh-btn-primary sh-btn-block">
          ${ICONS.send}
          <span>Send Report</span>
        </button>
      </form>
    </div>
  `;
}

/**
 * Submitting view - Spinner
 */
export function renderSubmittingView(): string {
  return `
    <div class="sh-view sh-view-center">
      <div class="sh-spinner"></div>
      <p class="sh-message">Sending your report...</p>
    </div>
  `;
}

/**
 * Success view
 */
export function renderSuccessView(ticketId: string, aiAnalysis?: ReportResponse['aiAnalysis'], dashboardUrl?: string): string {
  let analysisHtml = '';
  
  if (aiAnalysis) {
    const severityClass = aiAnalysis.severity === 'high' ? 'sh-badge-high' : 
                          aiAnalysis.severity === 'medium' ? 'sh-badge-medium' : 'sh-badge-low';
    
    analysisHtml = `
      <div class="sh-analysis">
        <div class="sh-analysis-label">AI Analysis</div>
        <p class="sh-analysis-text">${escapeHtml(aiAnalysis.summary)}</p>
        <div style="margin-top: 8px;">
          <span class="sh-badge ${severityClass}">${aiAnalysis.severity} severity</span>
        </div>
      </div>
    `;
  }
  
  const ticketUrl = dashboardUrl || `#ticket-${ticketId}`;
  
  return `
    <div class="sh-view sh-view-center">
      <div class="sh-success-icon">
        ${ICONS.check}
      </div>
      <div class="sh-title">Report Sent!</div>
      <p class="sh-message">
        Your issue has been submitted successfully. Our team will analyze it and get back to you.
      </p>
      ${analysisHtml}
      <a class="sh-ticket-link" href="${ticketUrl}" target="_blank" rel="noopener">
        View ticket #${escapeHtml(ticketId.substring(0, 8))}
        ${ICONS.externalLink}
      </a>
      <button class="sh-btn sh-btn-secondary sh-btn-block" data-action="close" style="margin-top: 12px;">
        Close
      </button>
    </div>
  `;
}

/**
 * Error view
 */
export function renderErrorView(message: string): string {
  return `
    <div class="sh-view sh-view-center">
      <div class="sh-error-icon">
        ${ICONS.alertCircle}
      </div>
      <div class="sh-title">Something went wrong</div>
      <p class="sh-message">${escapeHtml(message)}</p>
      <div class="sh-btn-group" style="margin-top: 8px;">
        <button class="sh-btn sh-btn-secondary" data-action="close">
          Close
        </button>
        <button class="sh-btn sh-btn-primary" data-action="retry">
          ${ICONS.refresh}
          <span>Try again</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Get view content based on state
 */
export function getViewForState(
  state: WidgetState,
  context: {
    videoUrl?: string;
    duration?: number;
    size?: number;
    isPaused?: boolean;
    ticketId?: string;
    aiAnalysis?: ReportResponse['aiAnalysis'];
    dashboardUrl?: string;
    errorMessage?: string;
  }
): string {
  switch (state) {
    case 'open':
      return renderOpenView();
    case 'recording':
      return renderRecordingView(context.duration || 0, context.isPaused || false);
    case 'preview':
      return renderPreviewView(context.videoUrl || '', context.duration || 0, context.size || 0);
    case 'editing':
      return renderEditingView(context.videoUrl || '', context.duration || 0);
    case 'submitting':
      return renderSubmittingView();
    case 'success':
      return renderSuccessView(context.ticketId || '', context.aiAnalysis, context.dashboardUrl);
    case 'error':
      return renderErrorView(context.errorMessage || 'An unknown error occurred.');
    default:
      return renderOpenView();
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Format file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
