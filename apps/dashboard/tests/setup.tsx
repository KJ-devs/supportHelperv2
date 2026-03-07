import '@testing-library/jest-dom';
import { vi } from 'vitest';
import frMessages from '../messages/fr.json';

// Mock next-intl — use actual FR messages so tests see real translated strings
vi.mock('next-intl', () => {
  function getNestedValue(obj: Record<string, unknown>, path: string): string {
    return (
      (path.split('.').reduce<unknown>((acc, key) => {
        if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
        return undefined;
      }, obj) as string) ?? path
    );
  }

  function createTranslator(namespace: string) {
    return (key: string, params?: Record<string, unknown>): string => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      let value = getNestedValue(frMessages as unknown as Record<string, unknown>, fullPath);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(`{${k}}`, String(v));
        });
      }
      return value ?? key;
    };
  }

  return {
    useTranslations: (namespace: string = '') => createTranslator(namespace),
    useLocale: () => 'fr',
    useMessages: () => frMessages,
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
    getTranslations: async (namespace: string = '') => createTranslator(namespace),
    getLocale: async () => 'fr',
    getMessages: async () => frMessages,
  };
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt as string} />;
  },
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock MediaError for video player tests
if (typeof MediaError === 'undefined') {
  // @ts-expect-error - MediaError is not defined in jsdom
  global.MediaError = class MediaError {
    static MEDIA_ERR_ABORTED = 1;
    static MEDIA_ERR_NETWORK = 2;
    static MEDIA_ERR_DECODE = 3;
    static MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

    MEDIA_ERR_ABORTED = 1;
    MEDIA_ERR_NETWORK = 2;
    MEDIA_ERR_DECODE = 3;
    MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

    code: number;
    message: string;

    constructor(code: number, message: string) {
      this.code = code;
      this.message = message;
    }
  };
}
