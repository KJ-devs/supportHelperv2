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
export function createWidgetStyles(primaryColor: string, zIndex: number, position: WidgetPosition): string {
  return `
    :host {
      --sh-primary: ${primaryColor};
      --sh-primary-hover: color-mix(in srgb, ${primaryColor} 85%, black);
      --sh-primary-light: color-mix(in srgb, ${primaryColor} 15%, white);
      --sh-text: #1f2937;
      --sh-text-secondary: #6b7280;
      --sh-bg: #ffffff;
      --sh-bg-secondary: #f3f4f6;
      --sh-border: #e5e7eb;
      --sh-error: #ef4444;
      --sh-success: #22c55e;
      --sh-shadow: rgba(0, 0, 0, 0.15);
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
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .sh-fab:hover {
      transform: scale(1.08);
      background: var(--sh-primary-hover);
      box-shadow: 0 6px 20px var(--sh-shadow);
    }

    .sh-fab:active {
      transform: scale(0.96);
    }

    .sh-fab svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
    }

    /* Modal Backdrop */
    .sh-backdrop {
      position: fixed;
      inset: 0;
      z-index: calc(var(--sh-z-index) + 1);
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      animation: sh-fade-in 0.2s ease;
    }

    @keyframes sh-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* Modal Container */
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
      animation: sh-slide-in 0.25s ease;
      overflow: hidden;
    }

    @keyframes sh-slide-in {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
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
      transition: all 0.2s ease;
      font-family: inherit;
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
    }

    .sh-btn-secondary {
      background: var(--sh-bg-secondary);
      color: var(--sh-text);
      border: 1px solid var(--sh-border);
    }

    .sh-btn-secondary:hover:not(:disabled) {
      background: var(--sh-border);
    }

    .sh-btn-danger {
      background: var(--sh-error);
      color: white;
    }

    .sh-btn-danger:hover:not(:disabled) {
      background: color-mix(in srgb, var(--sh-error) 85%, black);
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
      animation: sh-pulse 1s infinite;
    }

    .sh-timer-dot.paused {
      animation: none;
      background: var(--sh-text-secondary);
    }

    @keyframes sh-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
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

    .sh-input, .sh-textarea {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--sh-border);
      border-radius: var(--sh-radius-sm);
      font-size: 14px;
      font-family: inherit;
      background: var(--sh-bg);
      color: var(--sh-text);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .sh-input:focus, .sh-textarea:focus {
      outline: none;
      border-color: var(--sh-primary);
      box-shadow: 0 0 0 3px var(--sh-primary-light);
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

    /* Success Icon */
    .sh-success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--sh-success);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sh-success-icon svg {
      width: 32px;
      height: 32px;
    }

    /* Error Icon */
    .sh-error-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--sh-error);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
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
  `;
}
