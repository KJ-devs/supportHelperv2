/**
 * Widget Styles - CSS-in-JS for Shadow DOM with CSS custom properties theming
 */

import type { WidgetPosition } from './widget-types';
import { POSITION_STYLES, MODAL_POSITION } from './widget-config';

/**
 * Generate position CSS for FAB
 */
function getPositionCSS(position: WidgetPosition): string {
  const pos = POSITION_STYLES[position];
  return Object.entries(pos)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
}

/**
 * Generate position CSS for modal
 */
function getModalPositionCSS(position: WidgetPosition): string {
  const pos = MODAL_POSITION[position];
  return Object.entries(pos)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
}

/**
 * Create widget styles
 */
export function createWidgetStyles(primaryColor: string, zIndex: number, position: WidgetPosition, isDark: boolean): string {
  return `
    :host {
      --sh-primary: ${primaryColor};
      --sh-primary-hover: color-mix(in srgb, ${primaryColor} 85%, ${isDark ? 'white' : 'black'});
      --sh-primary-light: color-mix(in srgb, ${primaryColor} 15%, ${isDark ? 'black' : 'white'});
      --sh-text: ${isDark ? '#e0e0e0' : '#1f2937'};
      --sh-text-secondary: ${isDark ? '#9ca3af' : '#6b7280'};
      --sh-bg: ${isDark ? '#1a1a2e' : '#ffffff'};
      --sh-bg-secondary: ${isDark ? '#16213e' : '#f3f4f6'};
      --sh-border: ${isDark ? '#374151' : '#e5e7eb'};
      --sh-error: #ef4444;
      --sh-success: #22c55e;
      --sh-shadow: ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)'};
      --sh-radius: 12px;
      --sh-radius-sm: 8px;
      --sh-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --sh-z-index: ${zIndex};

      all: initial;
      font-family: var(--sh-font);
      color: var(--sh-text);
      box-sizing: border-box;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    /* Hidden state */
    .sh-hidden {
      display: none !important;
    }

    /* Screen reader only - visually hidden but accessible */
    .sh-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    /* Floating Action Button */
    .sh-fab {
      position: fixed;
      ${getPositionCSS(position)}
      z-index: var(--sh-z-index);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--sh-primary);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px var(--sh-shadow);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.2s ease,
                  background 0.2s ease;
    }

    .sh-fab:hover {
      transform: scale(1.08);
      background: var(--sh-primary-hover);
      box-shadow: 0 6px 20px var(--sh-shadow);
    }

    .sh-fab:active {
      transform: scale(0.96);
    }

    .sh-fab:focus-visible {
      outline: 3px solid var(--sh-primary);
      outline-offset: 2px;
    }

    .sh-fab svg {
      width: 24px;
      height: 24px;
    }

    /* FAB attention pulse animation - triggered after inactivity */
    .sh-fab.sh-attention-pulse {
      animation: sh-fab-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 3;
    }

    @keyframes sh-fab-pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 4px 14px var(--sh-shadow);
      }
      50% {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(var(--sh-primary), 0.4);
      }
    }

    /* Modal Backdrop */
    .sh-backdrop {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sh-z-index) + 1);
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      animation: sh-fade-in 0.25s ease;
    }

    /* Hide backdrop and modal during recording so page is fully visible */
    :host([data-state="recording"]) .sh-backdrop,
    :host([data-state="recording"]) .sh-modal {
      display: none !important;
    }

    /* Minimal floating recording indicator */
    .sh-recording-bar {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: calc(var(--sh-z-index) + 3);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      border-radius: 999px;
      font-family: var(--sh-font);
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      animation: sh-fade-in 0.25s ease;
    }

    .sh-recording-bar .sh-rec-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #ef4444;
      animation: sh-rec-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .sh-recording-bar .sh-rec-dot.paused {
      animation: none;
      background: #9ca3af;
    }

    @keyframes sh-rec-pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(1.2);
      }
    }

    .sh-recording-bar .sh-rec-time {
      font-variant-numeric: tabular-nums;
    }

    .sh-recording-bar button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
      font-weight: 500;
      transition: background 0.15s ease, transform 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .sh-recording-bar button:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    .sh-recording-bar button.sh-rec-stop {
      background: #ef4444;
    }

    .sh-recording-bar button.sh-rec-stop:hover {
      background: #dc2626;
    }

    .sh-recording-bar button svg {
      width: 14px;
      height: 14px;
    }

    @keyframes sh-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Modal Container - spring animation */
    .sh-modal {
      position: fixed;
      ${getModalPositionCSS(position)}
      z-index: calc(var(--sh-z-index) + 2);
      width: 400px;
      max-width: calc(100vw - 40px);
      max-height: calc(100vh - 120px);
      background: var(--sh-bg);
      border-radius: var(--sh-radius);
      box-shadow: 0 20px 50px var(--sh-shadow);
      display: flex;
      flex-direction: column;
      animation: sh-modal-spring 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }

    @keyframes sh-modal-spring {
      0% {
        opacity: 0;
        transform: translateY(30px) scale(0.9);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Error state shake animation */
    :host([data-state="error"]) .sh-modal {
      animation: sh-modal-spring 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                 sh-shake 0.5s ease 0.4s;
    }

    @keyframes sh-shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
      20%, 40%, 60%, 80% { transform: translateX(8px); }
    }

    /* Modal Header */
    .sh-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--sh-border);
      flex-shrink: 0;
    }

    .sh-modal-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
      color: var(--sh-text);
    }

    .sh-close-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--sh-text-secondary);
      transition: background 0.2s ease, color 0.2s ease;
    }

    .sh-close-btn:hover {
      background: var(--sh-bg-secondary);
      color: var(--sh-text);
    }

    .sh-close-btn:focus-visible {
      outline: 2px solid var(--sh-primary);
      outline-offset: 2px;
    }

    .sh-close-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Modal Body */
    .sh-modal-body {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
    }

    /* Views */
    .sh-view {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sh-view-center {
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 200px;
    }

    /* Primary Button */
    .sh-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: var(--sh-radius-sm);
      font-size: 14px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: inherit;
    }

    .sh-btn:hover:not(:disabled) {
      transform: translateY(-2px);
    }

    .sh-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .sh-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .sh-btn-primary {
      background: var(--sh-primary);
      color: white;
    }

    .sh-btn-primary:hover:not(:disabled) {
      background: var(--sh-primary-hover);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .sh-btn-secondary {
      background: var(--sh-bg-secondary);
      color: var(--sh-text);
      border: 1px solid var(--sh-border);
    }

    .sh-btn-secondary:hover:not(:disabled) {
      background: var(--sh-border);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .sh-btn-danger {
      background: var(--sh-error);
      color: white;
    }

    .sh-btn-danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--sh-error) 85%, black);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .sh-btn-block {
      width: 100%;
    }

    .sh-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    /* Button Group */
    .sh-btn-group {
      display: flex;
      gap: 12px;
    }

    .sh-btn-group > * {
      flex: 1;
    }

    /* Recording Timer */
    .sh-timer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
    }

    .sh-timer-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--sh-error);
      animation: sh-rec-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    .sh-timer-dot.paused {
      animation: none;
      background: var(--sh-text-secondary);
    }

    .sh-timer-time {
      font-size: 32px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--sh-text);
    }

    /* Video Preview */
    .sh-video-container {
      width: 100%;
      border-radius: var(--sh-radius-sm);
      overflow: hidden;
      background: black;
    }

    .sh-video {
      width: 100%;
      max-height: 220px;
      display: block;
    }

    /* Form */
    .sh-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sh-form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sh-input, .sh-textarea {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--sh-border);
      border-radius: var(--sh-radius-sm);
      font-size: 14px;
      font-family: inherit;
      background: var(--sh-bg);
      color: var(--sh-text);
      transition: border-color 0.2s ease,
                  box-shadow 0.2s ease,
                  transform 0.2s ease;
    }

    .sh-input:focus, .sh-textarea:focus {
      outline: none;
      border-color: var(--sh-primary);
      box-shadow: 0 0 0 3px var(--sh-primary-light),
                  0 2px 8px rgba(0, 0, 0, 0.05);
      transform: translateY(-1px);
    }

    .sh-input:focus-visible, .sh-textarea:focus-visible {
      outline: 2px solid var(--sh-primary);
      outline-offset: 2px;
      border-color: var(--sh-primary);
      box-shadow: 0 0 0 3px var(--sh-primary-light);
    }

    .sh-input[aria-invalid="true"], .sh-textarea[aria-invalid="true"] {
      border-color: var(--sh-error);
    }

    .sh-input[aria-invalid="true"]:focus, .sh-textarea[aria-invalid="true"]:focus {
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .sh-input::placeholder, .sh-textarea::placeholder {
      color: var(--sh-text-secondary);
    }

    .sh-textarea {
      min-height: 100px;
      resize: vertical;
    }

    /* Video Thumbnail */
    .sh-video-thumb {
      width: 100%;
      border-radius: var(--sh-radius-sm);
      overflow: hidden;
      background: var(--sh-bg-secondary);
      position: relative;
    }

    .sh-video-thumb video {
      width: 100%;
      max-height: 140px;
      display: block;
    }

    .sh-video-thumb-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.4);
      color: white;
      font-size: 13px;
      gap: 6px;
    }

    .sh-video-thumb-overlay svg {
      width: 16px;
      height: 16px;
    }

    /* Spinner */
    .sh-spinner {
      width: 48px;
      height: 48px;
      border: 3px solid var(--sh-border);
      border-top-color: var(--sh-primary);
      border-radius: 50%;
      animation: sh-spin 0.8s linear infinite;
    }

    @keyframes sh-spin {
      to { transform: rotate(360deg); }
    }

    /* Success Icon - animated checkmark */
    .sh-success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--sh-success);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: sh-success-scale 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes sh-success-scale {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .sh-success-icon svg {
      width: 32px;
      height: 32px;
      animation: sh-check-draw 0.5s ease 0.3s both;
    }

    @keyframes sh-check-draw {
      0% {
        stroke-dasharray: 50;
        stroke-dashoffset: 50;
        opacity: 0;
      }
      100% {
        stroke-dasharray: 50;
        stroke-dashoffset: 0;
        opacity: 1;
      }
    }

    /* Error Icon - animated with pulse */
    .sh-error-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--sh-error);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: sh-error-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes sh-error-pulse {
      0%, 100% {
        transform: scale(1);
      }
      25% {
        transform: scale(1.1);
      }
      50% {
        transform: scale(0.95);
      }
      75% {
        transform: scale(1.05);
      }
    }

    .sh-error-icon svg {
      width: 32px;
      height: 32px;
    }

    /* Messages */
    .sh-message {
      font-size: 14px;
      color: var(--sh-text-secondary);
      line-height: 1.5;
    }

    .sh-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--sh-text);
      margin: 8px 0;
    }

    /* AI Analysis Card */
    .sh-analysis {
      background: var(--sh-primary-light);
      border-radius: var(--sh-radius-sm);
      padding: 14px;
      margin-top: 8px;
    }

    .sh-analysis-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--sh-primary);
      margin-bottom: 6px;
    }

    .sh-analysis-text {
      font-size: 13px;
      color: var(--sh-text);
      line-height: 1.5;
    }

    /* Severity Badge */
    .sh-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }

    .sh-badge-high {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
    }

    .sh-badge-medium {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }

    .sh-badge-low {
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;
    }

    /* Ticket Link */
    .sh-ticket-link {
      color: var(--sh-primary);
      text-decoration: none;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .sh-ticket-link:hover {
      text-decoration: underline;
    }

    .sh-ticket-link:focus-visible {
      outline: 2px solid var(--sh-primary);
      outline-offset: 2px;
      border-radius: 4px;
    }

    .sh-ticket-link svg {
      width: 14px;
      height: 14px;
    }

    /* Description text under video thumb */
    .sh-video-info {
      font-size: 12px;
      color: var(--sh-text-secondary);
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
    }

    /* Start view icon */
    .sh-start-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--sh-primary-light);
      color: var(--sh-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .sh-start-icon svg {
      width: 40px;
      height: 40px;
    }

    /* State transitions - crossfade effect */
    .sh-modal-body {
      animation: sh-crossfade 0.3s ease;
    }

    @keyframes sh-crossfade {
      0% {
        opacity: 0;
        transform: translateY(8px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Responsive */
    @media (max-width: 480px) {
      .sh-modal {
        width: 100%;
        max-width: 100%;
        max-height: 100%;
        height: 100%;
        border-radius: 0;
        inset: 0;
        bottom: auto;
        right: auto;
        left: auto;
        top: auto;
      }
    }

    /* Accessibility - Respect reduced motion preference */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }

      .sh-fab.sh-attention-pulse,
      .sh-rec-dot,
      .sh-timer-dot,
      .sh-spinner {
        animation: none !important;
      }

      .sh-fab:hover {
        transform: scale(1.02);
      }

      .sh-btn:hover:not(:disabled) {
        transform: none;
      }

      .sh-modal {
        animation: sh-fade-in 0.2s ease;
      }

      :host([data-state="error"]) .sh-modal {
        animation: sh-fade-in 0.2s ease;
      }
    }
  `;
}
