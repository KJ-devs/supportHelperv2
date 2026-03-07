import type { WidgetConfig, WidgetPosition } from './widget-types';

export const DEFAULT_CONFIG: Omit<WidgetConfig, 'sdkKey' | 'apiUrl'> = {
  position: 'bottom-right',
  primaryColor: '#6366f1',
  zIndex: 99999,
  theme: 'auto',
};

export const POSITION_STYLES: Record<
  WidgetPosition,
  { bottom?: string; top?: string; left?: string; right?: string }
> = {
  'bottom-right': { bottom: '20px', right: '20px' },
  'bottom-left': { bottom: '20px', left: '20px' },
  'top-right': { top: '20px', right: '20px' },
  'top-left': { top: '20px', left: '20px' },
};

export const MODAL_POSITION: Record<
  WidgetPosition,
  { bottom?: string; top?: string; left?: string; right?: string }
> = {
  'bottom-right': { bottom: '80px', right: '20px' },
  'bottom-left': { bottom: '80px', left: '20px' },
  'top-right': { top: '80px', right: '20px' },
  'top-left': { top: '80px', left: '20px' },
};

/**
 * Parse config from HTML attributes
 */
export function parseAttributeConfig(element: HTMLElement): Partial<WidgetConfig> {
  const config: Partial<WidgetConfig> = {};

  const sdkKey = element.getAttribute('sdk-key');
  if (sdkKey) config.sdkKey = sdkKey;

  const apiUrl = element.getAttribute('api-url');
  if (apiUrl) config.apiUrl = apiUrl;

  const position = element.getAttribute('position') as WidgetPosition | null;
  if (position && isValidPosition(position)) {
    config.position = position;
  }

  const primaryColor = element.getAttribute('primary-color');
  if (primaryColor) config.primaryColor = primaryColor;

  const zIndex = element.getAttribute('z-index');
  if (zIndex) {
    const parsed = parseInt(zIndex, 10);
    if (!isNaN(parsed)) config.zIndex = parsed;
  }

  const theme = element.getAttribute('theme');
  if (theme && isValidTheme(theme)) {
    config.theme = theme;
  }

  const locale = element.getAttribute('locale');
  if (locale && isValidLocale(locale)) {
    config.locale = locale;
  }

  return config;
}

/**
 * Validate position value
 */
function isValidPosition(value: string): value is WidgetPosition {
  return ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(value);
}

/**
 * Validate theme value
 */
function isValidTheme(value: string): value is import('./widget-types').WidgetTheme {
  return ['light', 'dark', 'auto'].includes(value);
}

/**
 * Validate locale value
 */
function isValidLocale(value: string): value is 'en' | 'fr' {
  return ['en', 'fr'].includes(value);
}
