export interface UncaughtError {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  type: 'error' | 'unhandledrejection';
  timestamp: string;
}

export class ErrorCapture {
  private static entries: UncaughtError[] = [];
  private static maxEntries = 20;
  private static installed = false;
  private static errorHandler: ((event: ErrorEvent) => void) | null = null;
  private static rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  static install(maxEntries = 20): void {
    if (this.installed || typeof window === 'undefined') return;
    this.maxEntries = maxEntries;
    this.installed = true;

    this.errorHandler = (event: ErrorEvent) => {
      this.capture({
        message:
          event.error instanceof Error ? event.error.message : event.message || 'Unknown error',
        filename: event.filename || undefined,
        lineno: event.lineno || undefined,
        colno: event.colno || undefined,
        stack: event.error instanceof Error ? event.error.stack?.slice(0, 1000) : undefined,
        type: 'error',
        timestamp: new Date().toISOString(),
      });
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.capture({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack?.slice(0, 1000) : undefined,
        type: 'unhandledrejection',
        timestamp: new Date().toISOString(),
      });
    };

    window.addEventListener('error', this.errorHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  static uninstall(): void {
    if (!this.installed || typeof window === 'undefined') return;
    if (this.errorHandler) window.removeEventListener('error', this.errorHandler);
    if (this.rejectionHandler)
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
    this.errorHandler = null;
    this.rejectionHandler = null;
    this.installed = false;
  }

  static getEntries(): UncaughtError[] {
    return [...this.entries];
  }

  static clear(): void {
    this.entries = [];
  }

  private static capture(entry: UncaughtError): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }
}
