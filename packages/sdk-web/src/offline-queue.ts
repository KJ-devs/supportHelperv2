/**
 * Offline Queue — IndexedDB-backed queue for offline report submissions.
 *
 * When the network is unavailable, reports are serialized into IndexedDB.
 * When connectivity returns, the queue is drained with exponential backoff.
 *
 * Limits:
 *   - MAX_ENTRIES: 50 reports
 *   - MAX_TOTAL_BYTES: 500 MB
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuedReport {
  /** Auto-assigned by IndexedDB (autoIncrement key). */
  id?: number;
  /** ISO timestamp when the report was queued. */
  queuedAt: string;
  /** Number of submission attempts so far. */
  attempts: number;
  /** ISO timestamp of the next retry (null = ready immediately). */
  nextRetryAt: string | null;

  // Report payload fields
  title: string;
  description: string;
  userContext: Record<string, unknown>;
  /** Serialized video Blob (may be null when no video was recorded). */
  videoBlob: Blob | null;

  // Submission config
  apiUrl: string;
  sdkKey: string;
}

export interface QueueStats {
  count: number;
  totalBytes: number;
}

export type QueueEventType = 'queue:flushed' | 'queue:error';

export interface QueueFlushedDetail {
  submitted: number;
  failed: number;
}

export interface QueueErrorDetail {
  entryId: number;
  message: string;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'support-helper-queue';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

const MAX_ENTRIES = 50;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 500 MB

/** Base delay for first retry (ms). Doubles each attempt, capped at MAX_BACKOFF_MS. */
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;

/** Maximum number of individual submission retries before a queued entry is discarded. */
const MAX_ATTEMPTS = 10;

// ---------------------------------------------------------------------------
// Lightweight IndexedDB wrapper
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

function idbAdd(db: IDBDatabase, entry: Omit<QueuedReport, 'id'>): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(entry);
    request.onsuccess = (event) => resolve((event.target as IDBRequest<number>).result);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

function idbGetAll(db: IDBDatabase): Promise<QueuedReport[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = (event) => resolve((event.target as IDBRequest<QueuedReport[]>).result);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

function idbDelete(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

function idbPut(db: IDBDatabase, entry: QueuedReport): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

function idbCount(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = (event) => resolve((event.target as IDBRequest<number>).result);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

// ---------------------------------------------------------------------------
// Backoff helpers
// ---------------------------------------------------------------------------

function computeBackoffMs(attempts: number): number {
  const delay = BASE_BACKOFF_MS * Math.pow(2, attempts);
  return Math.min(delay, MAX_BACKOFF_MS);
}

function isRetryReady(entry: QueuedReport): boolean {
  if (!entry.nextRetryAt) return true;
  return new Date(entry.nextRetryAt).getTime() <= Date.now();
}

// ---------------------------------------------------------------------------
// Serialise / submit a single entry
// ---------------------------------------------------------------------------

async function submitEntry(entry: QueuedReport): Promise<void> {
  const formData = new FormData();
  formData.append('title', entry.title);
  formData.append('description', entry.description);
  formData.append('userContext', JSON.stringify(entry.userContext));

  if (entry.videoBlob && entry.videoBlob.size > 0) {
    const ext = entry.videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('video', entry.videoBlob, `recording_${Date.now()}.${ext}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(`${entry.apiUrl}/api/sdk/tickets/report`, {
      method: 'POST',
      headers: { 'x-sdk-key': entry.sdkKey },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// OfflineQueue class
// ---------------------------------------------------------------------------

/**
 * OfflineQueue manages queued reports in IndexedDB and drains them when
 * the network becomes available, using exponential backoff.
 *
 * Usage:
 * ```ts
 * const queue = new OfflineQueue();
 * queue.on('queue:flushed', (detail) => console.log('Flushed', detail));
 * queue.on('queue:error',   (detail) => console.error('Error', detail));
 * await queue.initialize();
 * ```
 */
export class OfflineQueue {
  private db: IDBDatabase | null = null;
  private isFlushing = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // Event listeners
  private listeners: Map<QueueEventType, Array<(detail: QueueFlushedDetail | QueueErrorDetail) => void>> = new Map();

  // Network-state listeners (stored for removal)
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Open the IndexedDB database and start listening to network events.
   * Must be called before any other method.
   */
  async initialize(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      // IndexedDB not available (SSR, unit test without mock, etc.)
      return;
    }

    try {
      this.db = await openDB();
    } catch (error) {
      console.warn('[OfflineQueue] Could not open IndexedDB:', error);
      return;
    }

    // Listen for network transitions
    this.onlineHandler = () => this.scheduleFlush(0);
    this.offlineHandler = () => this.cancelFlush();

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // If we are already online and there are pending entries, drain immediately.
    if (navigator.onLine) {
      this.scheduleFlush(0);
    }
  }

  /**
   * Remove event listeners and close the database connection.
   */
  destroy(): void {
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
    }
    this.cancelFlush();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns true when the browser reports an active network connection.
   */
  get isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Enqueue a report for later submission.
   * Throws if the queue is full or the total size limit would be exceeded.
   */
  async enqueue(report: Omit<QueuedReport, 'id' | 'queuedAt' | 'attempts' | 'nextRetryAt'>): Promise<void> {
    if (!this.db) {
      throw new Error('[OfflineQueue] Not initialized');
    }

    const count = await idbCount(this.db);
    if (count >= MAX_ENTRIES) {
      throw new Error(`[OfflineQueue] Queue is full (${MAX_ENTRIES} entries)`);
    }

    // Estimate total stored bytes
    const all = await idbGetAll(this.db);
    const totalBytes = all.reduce((sum, e) => sum + this.estimateEntryBytes(e), 0);
    const incomingBytes = this.estimateEntryBytes(report as QueuedReport);
    if (totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
      throw new Error('[OfflineQueue] Queue size limit exceeded (500 MB)');
    }

    const entry: Omit<QueuedReport, 'id'> = {
      ...report,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      nextRetryAt: null,
    };

    await idbAdd(this.db, entry);
  }

  /**
   * Return current queue statistics.
   */
  async getStats(): Promise<QueueStats> {
    if (!this.db) return { count: 0, totalBytes: 0 };

    const all = await idbGetAll(this.db);
    const totalBytes = all.reduce((sum, e) => sum + this.estimateEntryBytes(e), 0);
    return { count: all.length, totalBytes };
  }

  /**
   * Drain all ready entries in the queue. Network connectivity is re-checked
   * before each entry. Entries that fail are rescheduled with exponential
   * backoff; entries that exceed MAX_ATTEMPTS are discarded.
   */
  async flush(): Promise<{ submitted: number; failed: number }> {
    if (!this.db || this.isFlushing) {
      return { submitted: 0, failed: 0 };
    }

    this.isFlushing = true;
    let submitted = 0;
    let failed = 0;

    try {
      const all = await idbGetAll(this.db);
      const ready = all.filter(isRetryReady);

      for (const entry of ready) {
        // Re-check network before each entry
        if (!navigator.onLine) break;

        const id = entry.id as number;

        try {
          await submitEntry(entry);
          await idbDelete(this.db, id);
          submitted++;
        } catch (error) {
          failed++;
          const attempts = entry.attempts + 1;

          if (attempts >= MAX_ATTEMPTS) {
            // Give up — remove the entry
            await idbDelete(this.db, id);
            this.emit('queue:error', {
              entryId: id,
              message: `Discarded after ${MAX_ATTEMPTS} failed attempts: ${error instanceof Error ? error.message : String(error)}`,
              attempts,
            });
          } else {
            // Reschedule with backoff
            const nextRetryAt = new Date(Date.now() + computeBackoffMs(attempts)).toISOString();
            const updated: QueuedReport = { ...entry, id, attempts, nextRetryAt };
            await idbPut(this.db, updated);

            this.emit('queue:error', {
              entryId: id,
              message: error instanceof Error ? error.message : String(error),
              attempts,
            });

            // Schedule the next flush to fire when the next entry is due
            this.scheduleFlush(computeBackoffMs(attempts));
          }
        }
      }
    } finally {
      this.isFlushing = false;
    }

    if (submitted > 0 || failed > 0) {
      this.emit('queue:flushed', { submitted, failed });
    }

    return { submitted, failed };
  }

  // ---------------------------------------------------------------------------
  // Event emitter (minimal)
  // ---------------------------------------------------------------------------

  on(event: 'queue:flushed', listener: (detail: QueueFlushedDetail) => void): void;
  on(event: 'queue:error', listener: (detail: QueueErrorDetail) => void): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  on(
    event: QueueEventType,
    // Union type accepted by the implementation — individual overloads narrow it.
    listener: ((detail: QueueFlushedDetail) => void) | ((detail: QueueErrorDetail) => void),
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(
      listener as (detail: QueueFlushedDetail | QueueErrorDetail) => void,
    );
  }

  off(event: 'queue:flushed', listener: (detail: QueueFlushedDetail) => void): void;
  off(event: 'queue:error', listener: (detail: QueueErrorDetail) => void): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  off(
    event: QueueEventType,
    listener: ((detail: QueueFlushedDetail) => void) | ((detail: QueueErrorDetail) => void),
  ): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    const cast = listener as (detail: QueueFlushedDetail | QueueErrorDetail) => void;
    const idx = arr.indexOf(cast);
    if (idx !== -1) arr.splice(idx, 1);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private emit(event: QueueEventType, detail: QueueFlushedDetail | QueueErrorDetail): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    for (const fn of arr) {
      try {
        fn(detail);
      } catch {
        // never let a listener crash the queue
      }
    }
  }

  private scheduleFlush(delayMs: number): void {
    this.cancelFlush();
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch((err) => {
        console.warn('[OfflineQueue] Flush error:', err);
      });
    }, delayMs);
  }

  private cancelFlush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Rough byte estimate for a queue entry (videoBlob size + ~1 KB for metadata).
   */
  private estimateEntryBytes(entry: Partial<QueuedReport>): number {
    const metaBytes = 1024; // conservative estimate for JSON fields
    const videoBytes = entry.videoBlob?.size ?? 0;
    return metaBytes + videoBytes;
  }
}
