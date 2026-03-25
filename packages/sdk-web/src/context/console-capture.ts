export interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: string;
  stack?: string;
}

type ConsoleLevel = ConsoleLogEntry['level'];

const LEVELS: ConsoleLevel[] = ['log', 'warn', 'error', 'info', 'debug'];

export class ConsoleCapture {
  private static entries: ConsoleLogEntry[] = [];
  private static maxEntries = 50;
  private static originalConsole: Partial<Record<ConsoleLevel, (...args: unknown[]) => void>> = {};
  private static installed = false;

  static install(maxEntries = 50): void {
    if (this.installed) return;
    this.maxEntries = maxEntries;
    this.installed = true;

    for (const level of LEVELS) {
      this.originalConsole[level] = console[level];
      console[level] = (...args: unknown[]) => {
        this.capture(level, args);
        this.originalConsole[level]?.apply(console, args);
      };
    }
  }

  static uninstall(): void {
    if (!this.installed) return;
    for (const level of LEVELS) {
      if (this.originalConsole[level]) {
        console[level] = this.originalConsole[level] as (...args: unknown[]) => void;
      }
    }
    this.originalConsole = {};
    this.installed = false;
  }

  static getEntries(): ConsoleLogEntry[] {
    return [...this.entries];
  }

  static clear(): void {
    this.entries = [];
  }

  private static capture(level: ConsoleLevel, args: unknown[]): void {
    const entry: ConsoleLogEntry = {
      level,
      message: this.serializeArgs(args).slice(0, 500),
      timestamp: new Date().toISOString(),
    };

    const errorArg = args.find((a): a is Error => a instanceof Error);
    if (errorArg?.stack) {
      entry.stack = errorArg.stack.slice(0, 1000);
    }

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  private static serializeArgs(args: unknown[]): string {
    return args
      .map(a => {
        if (a instanceof Error) return `${a.name}: ${a.message}`;
        if (typeof a === 'object' && a !== null) {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(' ');
  }
}
