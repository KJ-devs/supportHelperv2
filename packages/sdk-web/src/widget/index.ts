/**
 * Widget Entry Point
 * Exports the widget and registers the custom element
 */

import { SupportHelperElement } from './support-helper-element';

// Export everything
export { SupportHelperElement } from './support-helper-element';
export { WidgetStateMachine } from './widget-state-machine';
export { submitReport } from './widget-api';
export * from './widget-types';
export * from './widget-config';

/**
 * Register the custom element if not already registered
 */
function registerElement(): void {
  if (typeof window !== 'undefined' && !customElements.get('support-helper')) {
    customElements.define('support-helper', SupportHelperElement);
  }
}

// Auto-register in browser environment
registerElement();

/**
 * Programmatic initialization helper
 * Usage: SupportHelper.init({ sdkKey: '...', apiUrl: '...' });
 */
export interface InitOptions {
  sdkKey: string;
  apiUrl: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  zIndex?: number;
  container?: HTMLElement;
}

export function init(options: InitOptions): SupportHelperElement {
  // Ensure element is registered
  registerElement();

  // Create element
  const element = document.createElement('support-helper') as SupportHelperElement;

  // Set attributes
  element.setAttribute('sdk-key', options.sdkKey);
  element.setAttribute('api-url', options.apiUrl);

  if (options.position) {
    element.setAttribute('position', options.position);
  }
  if (options.primaryColor) {
    element.setAttribute('primary-color', options.primaryColor);
  }
  if (options.zIndex !== undefined) {
    element.setAttribute('z-index', options.zIndex.toString());
  }

  // Append to container or body
  const container = options.container || document.body;
  container.appendChild(element);

  return element;
}

/**
 * Global namespace for CDN usage
 */
if (typeof window !== 'undefined') {
  (window as any).SupportHelper = {
    init,
    Element: SupportHelperElement,
  };
}
