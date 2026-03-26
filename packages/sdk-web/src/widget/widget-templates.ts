/**
 * Widget Templates - Pure functions returning HTML for each view
 */

import type { WidgetState, ReportResponse, AnalyzingContext } from './widget-types';
import type { WidgetTranslations } from './i18n';

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

  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
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
export function renderFAB(t: WidgetTranslations): string {
  const tooltip = t.fab.tooltip;
  return `
    <button
      class="sh-fab"
      title="${escapeHtml(tooltip)}"
      data-action="open"
      aria-label="${escapeHtml(tooltip)}"
      tabindex="0"
    >
      ${ICONS.help}
    </button>
  `;
}

/**
 * Modal shell with header
 */
export function renderModal(title: string, bodyContent: string, t: WidgetTranslations): string {
  return `
    <div class="sh-backdrop" data-action="close" aria-hidden="true"></div>
    <div class="sh-modal" role="dialog" aria-modal="true" aria-labelledby="sh-modal-title">
      <div class="sh-modal-header">
        <h2 class="sh-modal-title" id="sh-modal-title">${escapeHtml(title)}</h2>
        <button
          class="sh-close-btn"
          data-action="close"
          aria-label="${escapeHtml(t.modal.closeDialog)}"
          tabindex="0"
        >
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
export function renderOpenView(t: WidgetTranslations): string {
  return `
    <div class="sh-view sh-view-center">
      <div class="sh-start-icon" aria-hidden="true">
        ${ICONS.video}
      </div>
      <div class="sh-title">${escapeHtml(t.open.title)}</div>
      <p class="sh-message">
        ${escapeHtml(t.open.message)}
      </p>
      <div style="display: flex; gap: 8px;">
        <button
          class="sh-btn sh-btn-primary"
          style="flex: 1;"
          data-action="start"
          aria-label="${escapeHtml(t.open.startRecording)}"
          tabindex="0"
        >
          ${ICONS.video}
          <span>${escapeHtml(t.open.startRecording)}</span>
        </button>
        <button
          class="sh-btn sh-btn-secondary"
          style="flex: 1;"
          data-action="screenshot"
          aria-label="${escapeHtml(t.open.takeScreenshot)}"
          tabindex="0"
        >
          ${ICONS.camera}
          <span>${escapeHtml(t.open.takeScreenshot)}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Recording view - Timer + stop button (used inside modal for non-recording states)
 */
export function renderRecordingView(
  elapsedSeconds: number,
  isPaused: boolean,
  t: WidgetTranslations
): string {
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
        ${isPaused ? escapeHtml(t.recording.paused) : escapeHtml(t.recording.recording)}
      </p>
      <div class="sh-btn-group">
        <button class="sh-btn sh-btn-secondary" data-action="${isPaused ? 'resume' : 'pause'}">
          ${isPaused ? ICONS.play : ICONS.pause}
          <span>${isPaused ? escapeHtml(t.recording.resume) : escapeHtml(t.recording.pause)}</span>
        </button>
        <button class="sh-btn sh-btn-danger" data-action="stop">
          ${ICONS.stop}
          <span>${escapeHtml(t.recording.stop)}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Minimal floating recording bar - shown during recording instead of modal
 * No backdrop/overlay so the page is fully visible and capturable
 */
export function renderRecordingBar(
  elapsedSeconds: number,
  isPaused: boolean,
  t: WidgetTranslations
): string {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return `
    <div class="sh-recording-bar" role="status" aria-live="polite">
      <span class="sh-rec-dot ${isPaused ? 'paused' : ''}" aria-hidden="true"></span>
      <span class="sh-rec-time sh-timer-time" aria-label="Recording time ${timeStr}">${timeStr}</span>
      <button
        data-action="${isPaused ? 'resume' : 'pause'}"
        aria-label="${isPaused ? escapeHtml(t.recording.resume) : escapeHtml(t.recording.pause)}"
        tabindex="0"
      >
        ${isPaused ? escapeHtml(t.recording.resume) : escapeHtml(t.recording.pause)}
      </button>
      <button
        class="sh-rec-stop"
        data-action="stop"
        aria-label="${escapeHtml(t.recording.stop)}"
        tabindex="0"
      >
        ${escapeHtml(t.recording.stop)}
      </button>
    </div>
  `;
}

/**
 * Preview view - Video player + accept/re-record
 */
export function renderPreviewView(
  videoUrl: string,
  duration: number,
  size: number,
  t: WidgetTranslations
): string {
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const sizeStr = formatFileSize(size);

  return `
    <div class="sh-view">
      <div class="sh-video-container">
        <video
          class="sh-video"
          src="${videoUrl}"
          controls
          aria-label="${escapeHtml(t.preview.previewLabel)}"
        ></video>
      </div>
      <div class="sh-video-info" aria-live="polite">
        <span>${escapeHtml(t.preview.duration)} ${timeStr}</span>
        <span>${escapeHtml(t.preview.size)} ${sizeStr}</span>
      </div>
      <div class="sh-btn-group">
        <button
          class="sh-btn sh-btn-secondary"
          data-action="re-record"
          aria-label="${escapeHtml(t.preview.recordAgain)}"
          tabindex="0"
        >
          ${ICONS.refresh}
          <span>${escapeHtml(t.preview.recordAgain)}</span>
        </button>
        <button
          class="sh-btn sh-btn-primary"
          data-action="accept"
          aria-label="${escapeHtml(t.preview.useThisVideo)}"
          tabindex="0"
        >
          ${ICONS.check}
          <span>${escapeHtml(t.preview.useThisVideo)}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Editing view - Form with title, description, video thumbnail
 */
export function renderEditingView(
  videoUrl: string,
  duration: number,
  t: WidgetTranslations
): string {
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  return `
    <div class="sh-view">
      <form class="sh-form" data-form="report" aria-label="${escapeHtml(t.editing.formLabel)}">
        <div class="sh-video-thumb">
          <video src="${videoUrl}" muted aria-hidden="true"></video>
          <div class="sh-video-thumb-overlay" aria-hidden="true">
            ${ICONS.film}
            <span>${timeStr} ${escapeHtml(t.editing.videoAttached)}</span>
          </div>
        </div>
        <div class="sh-form-field">
          <label for="sh-input-title" class="sh-sr-only">Issue title</label>
          <input
            id="sh-input-title"
            type="text"
            class="sh-input"
            name="title"
            placeholder="${escapeHtml(t.editing.titlePlaceholder)}"
            required
            maxlength="200"
            aria-required="true"
            aria-describedby="sh-title-hint"
            tabindex="0"
          />
          <span id="sh-title-hint" class="sh-sr-only">${escapeHtml(t.editing.titleHint)}</span>
        </div>
        <div class="sh-form-field">
          <label for="sh-input-description" class="sh-sr-only">Issue description</label>
          <textarea
            id="sh-input-description"
            class="sh-textarea"
            name="description"
            placeholder="${escapeHtml(t.editing.descriptionPlaceholder)}"
            required
            maxlength="2000"
            aria-required="true"
            aria-describedby="sh-description-hint"
            tabindex="0"
          ></textarea>
          <span id="sh-description-hint" class="sh-sr-only">${escapeHtml(t.editing.descriptionHint)}</span>
        </div>
        <button
          type="submit"
          class="sh-btn sh-btn-primary sh-btn-block"
          aria-label="${escapeHtml(t.editing.sendReport)}"
          tabindex="0"
        >
          ${ICONS.send}
          <span>${escapeHtml(t.editing.sendReport)}</span>
        </button>
      </form>
    </div>
  `;
}

/**
 * Submitting view - Spinner
 */
export function renderSubmittingView(t: WidgetTranslations): string {
  return `
    <div class="sh-view sh-view-center" role="status" aria-live="polite">
      <div class="sh-spinner" aria-hidden="true"></div>
      <p class="sh-message">${escapeHtml(t.submitting.sending)}</p>
    </div>
  `;
}

/**
 * Success view
 */
export function renderSuccessView(
  ticketId: string,
  t: WidgetTranslations,
  aiAnalysis?: ReportResponse['aiAnalysis'],
  dashboardUrl?: string
): string {
  let analysisHtml = '';

  if (aiAnalysis) {
    const severityClass =
      aiAnalysis.severity === 'high'
        ? 'sh-badge-high'
        : aiAnalysis.severity === 'medium'
          ? 'sh-badge-medium'
          : 'sh-badge-low';

    analysisHtml = `
      <div class="sh-analysis" role="region" aria-label="${escapeHtml(t.success.aiAnalysis)}">
        <div class="sh-analysis-label">${escapeHtml(t.success.aiAnalysis)}</div>
        <p class="sh-analysis-text">${escapeHtml(aiAnalysis.summary)}</p>
        <div style="margin-top: 8px;">
          <span class="sh-badge ${severityClass}" role="status">${aiAnalysis.severity} ${escapeHtml(t.success.severity)}</span>
        </div>
      </div>
    `;
  }

  const ticketUrl = dashboardUrl || `#ticket-${ticketId}`;

  return `
    <div class="sh-view sh-view-center" role="status" aria-live="polite">
      <div class="sh-success-icon" aria-hidden="true">
        ${ICONS.check}
      </div>
      <div class="sh-title">${escapeHtml(t.success.title)}</div>
      <p class="sh-message">
        ${escapeHtml(t.success.message)}
      </p>
      ${analysisHtml}
      <a
        class="sh-ticket-link"
        href="${ticketUrl}"
        target="_blank"
        rel="noopener"
        aria-label="${escapeHtml(t.success.viewTicket)} ${ticketId.substring(0, 8)}"
        tabindex="0"
      >
        ${escapeHtml(t.success.viewTicket)} #${escapeHtml(ticketId.substring(0, 8))}
        ${ICONS.externalLink}
      </a>
      <button
        class="sh-btn sh-btn-secondary sh-btn-block"
        data-action="close"
        style="margin-top: 12px;"
        aria-label="${escapeHtml(t.success.close)}"
        tabindex="0"
      >
        ${escapeHtml(t.success.close)}
      </button>
    </div>
  `;
}

/**
 * Analyzing view — shown while polling for AI results.
 * Covers three sub-states within the same template:
 *   1. Waiting (spinner + progress text)
 *   2. Results received (summary + severity + type)
 *   3. Timed out (fallback message)
 */
export function renderAnalyzingView(ctx: AnalyzingContext, t: WidgetTranslations): string {
  // --- timed out ---
  if (ctx.timedOut) {
    return `
      <div class="sh-view sh-view-center" role="status" aria-live="polite">
        <div class="sh-success-icon" aria-hidden="true">
          ${ICONS.check}
        </div>
        <div class="sh-title">${escapeHtml(t.success.title)}</div>
        <p class="sh-message">
          ${escapeHtml(t.analyzing.timedOutMessage)}
        </p>
        <button
          class="sh-btn sh-btn-secondary sh-btn-block"
          data-action="close"
          style="margin-top: 8px;"
          aria-label="${escapeHtml(t.modal.closeDialog)}"
          tabindex="0"
        >
          ${escapeHtml(t.success.close)}
        </button>
      </div>
    `;
  }

  // --- results received ---
  if (ctx.aiResult) {
    const severityClass =
      ctx.aiResult.severity === 'high'
        ? 'sh-badge-high'
        : ctx.aiResult.severity === 'medium'
          ? 'sh-badge-medium'
          : 'sh-badge-low';

    const typeHtml = ctx.aiResult.type
      ? `<span class="sh-badge sh-badge-type" style="margin-left:6px;">${escapeHtml(ctx.aiResult.type)}</span>`
      : '';

    return `
      <div class="sh-view sh-view-center" role="status" aria-live="polite">
        <div class="sh-success-icon" aria-hidden="true">
          ${ICONS.check}
        </div>
        <div class="sh-title">${escapeHtml(t.success.title)}</div>
        <div class="sh-analysis" role="region" aria-label="${escapeHtml(t.success.aiAnalysis)}">
          <div class="sh-analysis-label">${escapeHtml(t.success.aiAnalysis)}</div>
          <p class="sh-analysis-text">${escapeHtml(ctx.aiResult.summary)}</p>
          <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">
            ${
              ctx.aiResult.severity
                ? `<span class="sh-badge ${severityClass}" role="status">${escapeHtml(ctx.aiResult.severity)} ${escapeHtml(t.success.severity)}</span>`
                : ''
            }
            ${typeHtml}
          </div>
        </div>
        <button
          class="sh-btn sh-btn-secondary sh-btn-block"
          data-action="close"
          style="margin-top: 12px;"
          aria-label="${escapeHtml(t.modal.closeDialog)}"
          tabindex="0"
        >
          ${escapeHtml(t.success.close)}
        </button>
      </div>
    `;
  }

  // --- waiting / polling ---
  const elapsed = ctx.elapsedSeconds;
  const remaining = Math.max(0, 120 - elapsed);
  const progressPct = Math.min(100, Math.round((elapsed / 120) * 100));
  const timerText =
    remaining > 0
      ? t.analyzing.remaining.replace('{seconds}', String(remaining))
      : t.analyzing.almostDone;

  return `
    <div class="sh-view sh-view-center" role="status" aria-live="polite" aria-label="${escapeHtml(t.analyzing.title)}">
      <div class="sh-spinner" aria-hidden="true"></div>
      <div class="sh-title">${escapeHtml(t.analyzing.title)}</div>
      <p class="sh-message">
        ${escapeHtml(t.analyzing.message)}
      </p>
      <div class="sh-progress-bar" aria-hidden="true">
        <div class="sh-progress-fill" style="width: ${progressPct}%"></div>
      </div>
      <p class="sh-message sh-analyzing-timer" aria-live="off">
        ${escapeHtml(timerText)}
      </p>
      <button
        class="sh-btn sh-btn-secondary"
        data-action="close"
        style="margin-top: 8px;"
        aria-label="${escapeHtml(t.analyzing.closeBackground)}"
        tabindex="0"
      >
        ${escapeHtml(t.success.close)}
      </button>
    </div>
  `;
}

/**
 * Error view
 */
export function renderErrorView(message: string, t: WidgetTranslations): string {
  return `
    <div class="sh-view sh-view-center" role="alert" aria-live="assertive">
      <div class="sh-error-icon" aria-hidden="true">
        ${ICONS.alertCircle}
      </div>
      <div class="sh-title">${escapeHtml(t.error.title)}</div>
      <p class="sh-message">${escapeHtml(message)}</p>
      <div class="sh-btn-group" style="margin-top: 8px;">
        <button
          class="sh-btn sh-btn-secondary"
          data-action="close"
          aria-label="${escapeHtml(t.error.close)}"
          tabindex="0"
        >
          ${escapeHtml(t.error.close)}
        </button>
        <button
          class="sh-btn sh-btn-primary"
          data-action="retry"
          aria-label="${escapeHtml(t.error.tryAgain)}"
          tabindex="0"
        >
          ${ICONS.refresh}
          <span>${escapeHtml(t.error.tryAgain)}</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Cropping view - screen region selection
 */
export function renderCroppingView(
  imageDataUrl: string,
  mode: 'video' | 'screenshot',
  t: WidgetTranslations
): string {
  const instruction =
    mode === 'video' ? t.cropping.instructionVideo : t.cropping.instructionScreenshot;

  return `
    <div class="sh-view">
      <p class="sh-message">${escapeHtml(instruction)}</p>
      <div class="sh-crop-container">
        <img class="sh-crop-image" src="${imageDataUrl}" draggable="false" alt="" />
        <div class="sh-crop-overlay">
          <div class="sh-crop-selection" style="display:none;">
            <div class="sh-crop-handle" data-handle="nw"></div>
            <div class="sh-crop-handle" data-handle="n"></div>
            <div class="sh-crop-handle" data-handle="ne"></div>
            <div class="sh-crop-handle" data-handle="e"></div>
            <div class="sh-crop-handle" data-handle="se"></div>
            <div class="sh-crop-handle" data-handle="s"></div>
            <div class="sh-crop-handle" data-handle="sw"></div>
            <div class="sh-crop-handle" data-handle="w"></div>
            <div class="sh-crop-dimensions"></div>
          </div>
        </div>
      </div>
      <div class="sh-btn-group">
        <button class="sh-btn sh-btn-secondary" data-action="close" tabindex="0">
          ${escapeHtml(t.cropping.cancel)}
        </button>
        <button
          class="sh-btn sh-btn-primary sh-crop-confirm-btn"
          data-action="crop-confirm"
          disabled
          tabindex="0"
        >
          ${escapeHtml(t.cropping.confirm)}
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
    analyzingContext?: AnalyzingContext;
    cropImageDataUrl?: string;
    cropMode?: 'video' | 'screenshot';
  },
  t: WidgetTranslations
): string {
  switch (state) {
    case 'open':
      return renderOpenView(t);
    case 'cropping':
      return renderCroppingView(context.cropImageDataUrl || '', context.cropMode || 'video', t);
    case 'recording':
      return renderRecordingView(context.duration || 0, context.isPaused || false, t);
    case 'preview':
      return renderPreviewView(context.videoUrl || '', context.duration || 0, context.size || 0, t);
    case 'editing':
      return renderEditingView(context.videoUrl || '', context.duration || 0, t);
    case 'submitting':
      return renderSubmittingView(t);
    case 'analyzing':
      return renderAnalyzingView(
        context.analyzingContext || {
          ticketId: context.ticketId || '',
          elapsedSeconds: 0,
          timedOut: false,
        },
        t
      );
    case 'success':
      return renderSuccessView(context.ticketId || '', t, context.aiAnalysis, context.dashboardUrl);
    case 'error':
      return renderErrorView(context.errorMessage || t.error.unknownError, t);
    default:
      return renderOpenView(t);
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
