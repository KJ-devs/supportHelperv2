import '@testing-library/jest-dom';
import { vi } from 'vitest';

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
