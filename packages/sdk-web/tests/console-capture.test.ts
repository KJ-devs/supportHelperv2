import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleCapture } from '../src/context/console-capture';

afterEach(() => {
  ConsoleCapture.uninstall();
  ConsoleCapture.clear();
});

describe('ConsoleCapture', () => {
  describe('install / capture basics', () => {
    it('captures console.error with a string message', () => {
      ConsoleCapture.install();
      console.error('something went wrong');
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
      expect(entries[0].message).toBe('something went wrong');
    });

    it('captures console.warn', () => {
      ConsoleCapture.install();
      console.warn('heads up');
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('warn');
    });

    it('captures console.log', () => {
      ConsoleCapture.install();
      console.log('hello');
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('log');
    });

    it('captures console.info', () => {
      ConsoleCapture.install();
      console.info('info msg');
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
    });

    it('captures console.debug', () => {
      ConsoleCapture.install();
      console.debug('debug msg');
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('debug');
    });
  });

  describe('Error object handling', () => {
    it('captures Error objects with stack trace in stack field', () => {
      ConsoleCapture.install();
      const err = new Error('boom');
      console.error(err);
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Error: boom');
      expect(entries[0].stack).toBeDefined();
      expect(entries[0].stack).toContain('Error: boom');
    });

    it('does not set stack field when no Error argument is passed', () => {
      ConsoleCapture.install();
      console.error('plain string error');
      const entries = ConsoleCapture.getEntries();
      expect(entries[0].stack).toBeUndefined();
    });
  });

  describe('ring buffer', () => {
    it('enforces maxEntries: logging 10 times with maxEntries=5 keeps only 5', () => {
      ConsoleCapture.install(5);
      for (let i = 0; i < 10; i++) {
        console.log(`message ${i}`);
      }
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(5);
      // oldest entries are dropped — last 5 remain
      expect(entries[0].message).toBe('message 5');
      expect(entries[4].message).toBe('message 9');
    });
  });

  describe('message truncation', () => {
    it('truncates messages longer than 500 chars', () => {
      ConsoleCapture.install();
      const longMsg = 'x'.repeat(600);
      console.log(longMsg);
      const entries = ConsoleCapture.getEntries();
      expect(entries[0].message).toHaveLength(500);
    });

    it('does not truncate messages under 500 chars', () => {
      ConsoleCapture.install();
      console.log('short');
      expect(ConsoleCapture.getEntries()[0].message).toBe('short');
    });
  });

  describe('timestamp', () => {
    it('timestamps match ISO 8601 pattern', () => {
      ConsoleCapture.install();
      console.log('ts check');
      const { timestamp } = ConsoleCapture.getEntries()[0];
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('idempotency', () => {
    it('install is idempotent: installing twice and logging once yields 1 entry', () => {
      ConsoleCapture.install();
      ConsoleCapture.install();
      console.log('once');
      expect(ConsoleCapture.getEntries()).toHaveLength(1);
    });
  });

  describe('uninstall', () => {
    it('restores original console methods after uninstall', () => {
      const originalError = console.error;
      ConsoleCapture.install();
      ConsoleCapture.uninstall();
      expect(console.error).toBe(originalError);
    });

    it('does not capture after uninstall', () => {
      ConsoleCapture.install();
      ConsoleCapture.uninstall();
      console.log('should not be captured');
      expect(ConsoleCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('passthrough', () => {
    it('still calls original console methods after install', () => {
      const spy = vi.spyOn(console, 'log');
      // Grab the spy ref before install wraps it
      const originalSpy = spy.getMockImplementation();
      void originalSpy; // suppress unused warning

      ConsoleCapture.install();
      console.log('passthrough test');

      // The spy wraps the installed wrapper, so it should still have been called
      expect(spy).toHaveBeenCalledWith('passthrough test');
      spy.mockRestore();
    });

    it('original method is called even for error level', () => {
      // Capture the real console.error before installing
      const calls: unknown[][] = [];
      const realError = console.error.bind(console);
      console.error = (...args: unknown[]) => {
        calls.push(args);
        realError(...args);
      };

      ConsoleCapture.install();
      console.error('forwarded');
      ConsoleCapture.uninstall();

      // Our pre-install wrapper recorded one call
      expect(calls.length).toBeGreaterThanOrEqual(1);
      expect(calls[0][0]).toBe('forwarded');

      // Restore raw method for other tests
      console.error = realError;
    });
  });

  describe('circular references', () => {
    it('does not throw on circular reference objects', () => {
      ConsoleCapture.install();
      const obj: Record<string, unknown> = { a: 1 };
      obj['self'] = obj;
      expect(() => console.log(obj)).not.toThrow();
      const entries = ConsoleCapture.getEntries();
      expect(entries).toHaveLength(1);
      // Falls back to String(obj) = "[object Object]"
      expect(entries[0].message).toContain('[object Object]');
    });
  });

  describe('clear', () => {
    it('clear empties the buffer', () => {
      ConsoleCapture.install();
      console.log('one');
      console.log('two');
      ConsoleCapture.clear();
      expect(ConsoleCapture.getEntries()).toHaveLength(0);
    });
  });

  describe('getEntries', () => {
    it('returns a copy — mutating it does not affect internal state', () => {
      ConsoleCapture.install();
      console.log('original');
      const entries = ConsoleCapture.getEntries();
      entries.splice(0, 1); // remove the entry from the copy
      expect(ConsoleCapture.getEntries()).toHaveLength(1);
    });
  });
});
