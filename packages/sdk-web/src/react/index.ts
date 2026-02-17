/**
 * React Wrapper for Support Helper Widget
 *
 * Usage:
 * import { SupportHelperWidget } from '@support-helper/sdk-web/react';
 * <SupportHelperWidget sdkKey="sk_xxx" apiUrl="https://..." onSubmit={({ticketId}) => ...} />
 */

import type { ReportResponse, WidgetPosition, WidgetTheme } from '../widget/widget-types';

// Ensure the custom element is registered
import '../widget/index';

// Minimal types for when @types/react is not installed
type ReactRef<T> = { current: T | null } | ((instance: T | null) => void) | null;
type ReactCSSProperties = Record<string, string | number>;

export interface SupportHelperWidgetProps {
  /** SDK Key for authentication */
  sdkKey: string;
  /** API URL endpoint */
  apiUrl: string;
  /** Position of the floating button */
  position?: WidgetPosition;
  /** Primary theme color */
  primaryColor?: string;
  /** Z-index for the widget */
  zIndex?: number;
  /** Theme: light, dark, or auto (default: auto) */
  theme?: WidgetTheme;
  /** Called when the modal opens */
  onOpen?: () => void;
  /** Called when the modal closes */
  onClose?: () => void;
  /** Called when recording starts */
  onRecordingStart?: () => void;
  /** Called when recording stops */
  onRecordingStop?: (data: { duration: number; size: number }) => void;
  /** Called when report is successfully submitted */
  onSubmit?: (data: { ticketId: string; aiAnalysis?: ReportResponse['aiAnalysis'] }) => void;
  /** Called when an error occurs */
  onError?: (data: { message: string }) => void;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: ReactCSSProperties;
}

/**
 * Get React dynamically - avoids compile-time dependency
 */
function getReact(): {
  useRef: <T>(initial: T | null) => { current: T | null };
  useEffect: (effect: () => (() => void) | void, deps: unknown[]) => void;
  createElement: (type: string, props: Record<string, unknown>) => unknown;
} | null {
  try {
    // Check for globally available React (CDN or pre-bundled)
    const g = globalThis as Record<string, unknown>;
    if (g.React) return g.React as ReturnType<typeof getReact>;

    // In bundled environments, the consuming app provides React as a peer dependency.
    // We avoid eval/require to stay CSP-safe and bundler-compatible.
    return null;
  } catch {
    return null;
  }
}

/**
 * Support Helper Widget React Component
 *
 * This component wraps the <support-helper> custom element for React
 */
export function SupportHelperWidget(props: SupportHelperWidgetProps): unknown {
  const React = getReact();
  if (!React) {
    console.error('[SupportHelper] React is required for this component');
    return null;
  }

  const {
    sdkKey,
    apiUrl,
    position,
    primaryColor,
    zIndex,
    theme,
    onOpen,
    onClose,
    onRecordingStart,
    onRecordingStop,
    onSubmit,
    onError,
    className,
    style,
  } = props;

  const elementRef = React.useRef<HTMLElement>(null);

  // Attach event listeners
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handlers: [string, EventListener][] = [];

    if (onOpen) {
      const handler = (): void => onOpen();
      element.addEventListener('sh:open', handler);
      handlers.push(['sh:open', handler]);
    }

    if (onClose) {
      const handler = (): void => onClose();
      element.addEventListener('sh:close', handler);
      handlers.push(['sh:close', handler]);
    }

    if (onRecordingStart) {
      const handler = (): void => onRecordingStart();
      element.addEventListener('sh:recording-start', handler);
      handlers.push(['sh:recording-start', handler]);
    }

    if (onRecordingStop) {
      const handler = (e: Event): void => {
        const detail = (e as CustomEvent).detail;
        onRecordingStop(detail);
      };
      element.addEventListener('sh:recording-stop', handler);
      handlers.push(['sh:recording-stop', handler]);
    }

    if (onSubmit) {
      const handler = (e: Event): void => {
        const detail = (e as CustomEvent).detail;
        onSubmit(detail);
      };
      element.addEventListener('sh:submit', handler);
      handlers.push(['sh:submit', handler]);
    }

    if (onError) {
      const handler = (e: Event): void => {
        const detail = (e as CustomEvent).detail;
        onError(detail);
      };
      element.addEventListener('sh:error', handler);
      handlers.push(['sh:error', handler]);
    }

    return () => {
      for (const [event, handler] of handlers) {
        element.removeEventListener(event, handler);
      }
    };
  }, [onOpen, onClose, onRecordingStart, onRecordingStop, onSubmit, onError]);

  // Build attributes object
  const attrs: Record<string, string | number | undefined> = {
    'sdk-key': sdkKey,
    'api-url': apiUrl,
  };

  if (position) attrs['position'] = position;
  if (primaryColor) attrs['primary-color'] = primaryColor;
  if (zIndex !== undefined) attrs['z-index'] = zIndex;
  if (theme) attrs['theme'] = theme;

  // Use createElement to render custom element
  return React.createElement('support-helper', {
    ref: elementRef,
    class: className,
    style,
    ...attrs,
  });
}

/**
 * Hook to programmatically control the widget
 */
export function useSupportHelper(ref: ReactRef<HTMLElement>): {
  open: () => void;
  close: () => void;
  reset: () => void;
} {
  return {
    open: () => {
      const el = (ref && 'current' in ref ? ref.current : null) as
        | (HTMLElement & { open?: () => void })
        | null;
      if (el && typeof el.open === 'function') {
        el.open();
      }
    },
    close: () => {
      const el = (ref && 'current' in ref ? ref.current : null) as
        | (HTMLElement & { close?: () => void })
        | null;
      if (el && typeof el.close === 'function') {
        el.close();
      }
    },
    reset: () => {
      const el = (ref && 'current' in ref ? ref.current : null) as
        | (HTMLElement & { reset?: () => void })
        | null;
      if (el && typeof el.reset === 'function') {
        el.reset();
      }
    },
  };
}

export default SupportHelperWidget;
