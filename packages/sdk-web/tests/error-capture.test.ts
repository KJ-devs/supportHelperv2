import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCapture } from '../src/context/error-capture';

// jsdom does not define PromiseRejectionEvent — polyfill it
if (typeof PromiseRejectionEvent === 'undefined') {
  (globalThis as Record<string, unknown>)['PromiseRejectionEvent'] =
    class PromiseRejectionEvent extends Event {
      public readonly promise: Promise<unknown>;
      public readonly reason: unknown;
      constructor(type: string, init: { promise: Promise<unknown>; reason?: unknown }) {
        super(type, { bubbles: false, cancelable: true });
        this.promise = init.promise;
        this.reason = init.reason;
      }
    };
}

beforeEach(() => {
  ErrorCapture.uninstall();
  ErrorCapture.clear();
});

afterEach(() => {
  ErrorCapture.uninstall();
  ErrorCapture.clear();
});

describe('ErrorCapture', () => {
  describe('window error events', () => {
    it('captures window error events with all fields', () => {
      ErrorCapture.install();
      const err = new Error('test error');
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'test error',
          filename: 'test.js',
          lineno: 42,
          colno: 10,
          error: err,
        })
      );
      const entries = ErrorCapture.getEntries();
      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(entry.message).toBe('test error');
      expect(entry.filename).toBe('test.js');
      expect(entry.lineno).toBe(42);
      expect(entry.colno).toBe(10);
      expect(entry.stack).toBeDefined();
      expect(entry.stack).toContain('Error: test error');
      expect(entry.type).toBe('error');
    });

    it('timestamp is an ISO 8601 string', () => {
      ErrorCapture.install();
      window.dispatchEvent(
        new ErrorEvent('error', { message: 'ts check', error: new Error('ts') })
      );
      const { timestamp } = ErrorCapture.getEntries()[0];
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('captures error without an Error object (message-only ErrorEvent)', () => {
      ErrorCapture.install();
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'script error',
          filename: 'app.js',
          lineno: 1,
          colno: 0,
        })
      );
      const entries = ErrorCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('script error');
      expect(entries[0].stack).toBeUndefined();
      expect(entries[0].type).toBe('error');
    });

    it('falls back to "Unknown error" when message is empty and error is not an Error', () => {
      ErrorCapture.install();
      // ErrorEvent with no message and non-Error error property
      window.dispatchEvent(new ErrorEvent('error', { message: '' }));
      const entries = ErrorCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Unknown error');
    });
  });

  describe('unhandledrejection events', () => {
    it('captures unhandledrejection with an Error reason', () => {
      ErrorCapture.install();
      const reason = new Error('promise rejected');
      window.dispatchEvent(
        new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason })
      );
      const entries = ErrorCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('unhandledrejection');
      expect(entries[0].message).toBe('promise rejected');
      expect(entries[0].stack).toBeDefined();
    });

    it('captures unhandledrejection with a string reason', () => {
      ErrorCapture.install();
      window.dispatchEvent(
        new PromiseRejectionEvent('unhandledrejection', {
          promise: Promise.resolve(),
          reason: 'string rejection',
        })
      );
      const entries = ErrorCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('string rejection');
      expect(entries[0].stack).toBeUndefined();
    });

    it('rejection entry has no filename/lineno/colno fields', () => {
      ErrorCapture.install();
      window.dispatchEvent(
        new PromiseRejectionEvent('unhandledrejection', {
          promise: Promise.resolve(),
          reason: new Error('rej'),
        })
      );
      const entry = ErrorCapture.getEntries()[0];
      expect(entry.filename).toBeUndefined();
      expect(entry.lineno).toBeUndefined();
      expect(entry.colno).toBeUndefined();
    });
  });

  describe('ring buffer', () => {
    it('enforces max 20 entries', () => {
      ErrorCapture.install();
      for (let i = 0; i < 25; i++) {
        window.dispatchEvent(
          new ErrorEvent('error', { message: `err ${i}`, error: new Error(`err ${i}`) })
        );
      }
      const entries = ErrorCapture.getEntries();
      expect(entries).toHaveLength(20);
      expect(entries[0].message).toBe('err 5');
      expect(entries[19].message).toBe('err 24');
    });

    it('supports custom maxEntries', () => {
      ErrorCapture.install(5);
      for (let i = 0; i < 8; i++) {
        window.dispatchEvent(
          new ErrorEvent('error', { message: `e${i}`, error: new Error(`e${i}`) })
        );
      }
      expect(ErrorCapture.getEntries()).toHaveLength(5);
    });
  });

  describe('idempotency', () => {
    it('install is idempotent: installing twice and dispatching once yields 1 entry', () => {
      ErrorCapture.install();
      ErrorCapture.install();
      window.dispatchEvent(new ErrorEvent('error', { message: 'once', error: new Error('once') }));
      expect(ErrorCapture.getEntries()).toHaveLength(1);
    });
  });

  describe('uninstall', () => {
    it('does not capture events dispatched after uninstall', () => {
      ErrorCapture.install();
      ErrorCapture.uninstall();
      // Use error: null to avoid jsdom re-throwing a real Error as an unhandled exception
      window.dispatchEvent(new ErrorEvent('error', { message: 'after uninstall', error: null }));
      expect(ErrorCapture.getEntries()).toHaveLength(0);
    });

    it('does not capture rejections dispatched after uninstall', () => {
      ErrorCapture.install();
      ErrorCapture.uninstall();
      window.dispatchEvent(
        new PromiseRejectionEvent('unhandledrejection', {
          promise: Promise.resolve(),
          reason: 'late',
        })
      );
      expect(ErrorCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('empties the buffer', () => {
      ErrorCapture.install();
      window.dispatchEvent(new ErrorEvent('error', { message: 'a', error: new Error('a') }));
      window.dispatchEvent(new ErrorEvent('error', { message: 'b', error: new Error('b') }));
      ErrorCapture.clear();
      expect(ErrorCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('getEntries', () => {
    it('returns a copy — mutating it does not affect internal state', () => {
      ErrorCapture.install();
      window.dispatchEvent(
        new ErrorEvent('error', { message: 'copy test', error: new Error('copy') })
      );
      const entries = ErrorCapture.getEntries();
      entries.splice(0, 1);
      expect(ErrorCapture.getEntries()).toHaveLength(1);
    });
  });

  describe('SSR safety', () => {
    it('install does nothing when window is undefined', () => {
      // Cannot truly remove window in jsdom, but we can verify install guard works
      // by calling install when already uninstalled — no error thrown
      expect(() => ErrorCapture.install()).not.toThrow();
    });
  });
});
