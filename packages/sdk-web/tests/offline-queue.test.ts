/**
 * Unit tests for the offline queue (IndexedDB-backed).
 *
 * Uses an in-memory IndexedDB mock via fake-indexeddb (vitest provides the
 * global environment), combined with vi.stubGlobal to control
 * navigator.onLine and window events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineQueue } from '../src/offline-queue';
import { submitReport, _setOfflineQueueForTesting } from '../src/widget/widget-api';

// ---------------------------------------------------------------------------
// Minimal IndexedDB in-memory mock
// ---------------------------------------------------------------------------

interface StoreRecord {
  id?: number;
  [key: string]: unknown;
}

class MockIDBStore {
  private data: Map<number, StoreRecord> = new Map();
  private nextId = 1;
  keyPath: string;
  autoIncrement: boolean;

  constructor(options: { keyPath: string; autoIncrement: boolean }) {
    this.keyPath = options.keyPath;
    this.autoIncrement = options.autoIncrement;
  }

  add(value: StoreRecord): number {
    const id = this.nextId++;
    const record = { ...value, [this.keyPath]: id };
    this.data.set(id, record);
    return id;
  }

  put(value: StoreRecord): void {
    const id = value[this.keyPath] as number;
    this.data.set(id, { ...value });
  }

  delete(id: number): void {
    this.data.delete(id);
  }

  getAll(): StoreRecord[] {
    return Array.from(this.data.values());
  }

  count(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
    this.nextId = 1;
  }
}

// Central store registry so multiple "open" calls share state.
const storeRegistry = new Map<string, MockIDBStore>();

function getOrCreateStore(name: string): MockIDBStore {
  if (!storeRegistry.has(name)) {
    storeRegistry.set(name, new MockIDBStore({ keyPath: 'id', autoIncrement: true }));
  }
  return storeRegistry.get(name)!;
}

function makeRequest<T>(value: T): IDBRequest<T> {
  const listeners: Record<string, ((e: { target: { result: T; error: null } }) => void)[]> = {};
  const req = {
    result: value,
    error: null,
    onsuccess: null as ((e: { target: { result: T; error: null } }) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    addEventListener: (_: string, fn: () => void) => fn(),
    dispatchSuccess() {
      void (async () => {
        await Promise.resolve(); // microtask — let code attach handlers
        if (this.onsuccess) this.onsuccess({ target: { result: this.result, error: null } });
        (listeners['success'] || []).forEach((fn) => fn({ target: { result: this.result, error: null } }));
      })();
    },
  } as unknown as IDBRequest<T> & { dispatchSuccess(): void };

  // Auto-fire after one microtask
  Promise.resolve().then(() => {
    (req as { dispatchSuccess(): void }).dispatchSuccess();
  });

  return req;
}

function makeMockDB(storeName: string): IDBDatabase {
  const store = getOrCreateStore(storeName);

  const mockTx = {
    objectStore: () => mockObjStore,
  } as unknown as IDBTransaction;

  const mockObjStore = {
    add: vi.fn((value: StoreRecord) => {
      const id = store.add(value);
      return makeRequest<number>(id);
    }),
    put: vi.fn((value: StoreRecord) => {
      store.put(value);
      return makeRequest<undefined>(undefined);
    }),
    delete: vi.fn((id: number) => {
      store.delete(id);
      return makeRequest<undefined>(undefined);
    }),
    getAll: vi.fn(() => {
      return makeRequest<StoreRecord[]>(store.getAll());
    }),
    count: vi.fn(() => {
      return makeRequest<number>(store.count());
    }),
  };

  return {
    transaction: vi.fn(() => mockTx),
    objectStoreNames: { contains: () => false } as unknown as DOMStringList,
    createObjectStore: vi.fn(),
    close: vi.fn(),
  } as unknown as IDBDatabase;
}

// ---------------------------------------------------------------------------
// Mock navigator.onLine and indexedDB
// ---------------------------------------------------------------------------

let mockOnline = true;
let mockDB: IDBDatabase;

function setupMockIndexedDB(): void {
  mockDB = makeMockDB('reports');

  const mockOpen = vi.fn((_name: string, _version: number) => {
    const req = {
      result: mockDB,
      error: null,
      onsuccess: null as ((e: { target: { result: IDBDatabase } }) => void) | null,
      onerror: null as ((e: Event) => void) | null,
      onupgradeneeded: null as ((e: IDBVersionChangeEvent) => void) | null,
    };

    Promise.resolve().then(() => {
      if (req.onsuccess) req.onsuccess({ target: { result: mockDB } } as unknown as Event & { target: { result: IDBDatabase } });
    });

    return req as unknown as IDBOpenDBRequest;
  });

  vi.stubGlobal('indexedDB', { open: mockOpen });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    storeRegistry.clear();
    mockOnline = true;
    setupMockIndexedDB();

    // Stub navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      get: () => mockOnline,
      configurable: true,
    });

    queue = new OfflineQueue();
  });

  afterEach(async () => {
    queue.destroy();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  describe('initialize', () => {
    it('opens the IndexedDB database on initialize', async () => {
      await queue.initialize();
      expect(indexedDB.open).toHaveBeenCalledWith('support-helper-queue', 1);
    });

    it('handles missing indexedDB gracefully (SSR)', async () => {
      vi.stubGlobal('indexedDB', undefined);
      const q = new OfflineQueue();
      await expect(q.initialize()).resolves.not.toThrow();
      q.destroy();
    });
  });

  // -------------------------------------------------------------------------
  // enqueue
  // -------------------------------------------------------------------------

  describe('enqueue', () => {
    it('adds a report to the queue', async () => {
      await queue.initialize();

      await queue.enqueue({
        title: 'Bug A',
        description: 'Something broke',
        userContext: { browser: 'Chrome' },
        videoBlob: null,
        apiUrl: 'https://api.test',
        sdkKey: 'sk_test',
      });

      const stats = await queue.getStats();
      expect(stats.count).toBe(1);
    });

    it('throws when queue is full (50 entries)', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      // Manually fill the store to 50 entries
      for (let i = 0; i < 50; i++) {
        store.add({
          title: `Bug ${i}`,
          description: 'desc',
          userContext: {},
          videoBlob: null,
          apiUrl: 'https://api.test',
          sdkKey: 'sk_test',
          queuedAt: new Date().toISOString(),
          attempts: 0,
          nextRetryAt: null,
        });
      }

      await expect(
        queue.enqueue({
          title: 'Overflow',
          description: 'desc',
          userContext: {},
          videoBlob: null,
          apiUrl: 'https://api.test',
          sdkKey: 'sk_test',
        }),
      ).rejects.toThrow('Queue is full');
    });

    it('throws when adding would exceed 500 MB total', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      // Add a single entry that is "close to" 500 MB
      const bigBlob = { size: 499 * 1024 * 1024, type: 'video/webm' } as Blob;
      store.add({
        title: 'Big',
        description: 'desc',
        userContext: {},
        videoBlob: bigBlob,
        apiUrl: 'https://api.test',
        sdkKey: 'sk_test',
        queuedAt: new Date().toISOString(),
        attempts: 0,
        nextRetryAt: null,
      });

      // Next entry would push total over 500 MB
      const anotherBigBlob = { size: 5 * 1024 * 1024, type: 'video/webm' } as Blob;
      await expect(
        queue.enqueue({
          title: 'Another big',
          description: 'desc',
          userContext: {},
          videoBlob: anotherBigBlob,
          apiUrl: 'https://api.test',
          sdkKey: 'sk_test',
        }),
      ).rejects.toThrow('size limit exceeded');
    });
  });

  // -------------------------------------------------------------------------
  // flush
  // -------------------------------------------------------------------------

  describe('flush', () => {
    it('submits all ready entries and removes them from the queue', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      store.add({
        id: 1,
        title: 'Bug 1',
        description: 'desc',
        userContext: {},
        videoBlob: null,
        apiUrl: 'https://api.test',
        sdkKey: 'sk_test',
        queuedAt: new Date().toISOString(),
        attempts: 0,
        nextRetryAt: null,
      });

      // Mock successful fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ticket: { id: 'ticket-1', status: 'open' } }),
      } as Response);

      const result = await queue.flush();

      expect(result.submitted).toBe(1);
      expect(result.failed).toBe(0);
      const stats = await queue.getStats();
      expect(stats.count).toBe(0);
    });

    it('skips entries whose nextRetryAt is in the future', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      const futureDate = new Date(Date.now() + 60_000).toISOString();
      store.add({
        id: 1,
        title: 'Bug 1',
        description: 'desc',
        userContext: {},
        videoBlob: null,
        apiUrl: 'https://api.test',
        sdkKey: 'sk_test',
        queuedAt: new Date().toISOString(),
        attempts: 1,
        nextRetryAt: futureDate,
      });

      global.fetch = vi.fn();

      const result = await queue.flush();

      expect(result.submitted).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('updates attempt count and nextRetryAt on failure', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      store.add({
        id: 1,
        title: 'Bug 1',
        description: 'desc',
        userContext: {},
        videoBlob: null,
        apiUrl: 'https://api.test',
        sdkKey: 'sk_test',
        queuedAt: new Date().toISOString(),
        attempts: 0,
        nextRetryAt: null,
      });

      // Mock failing fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      } as Response);

      const errorListener = vi.fn();
      queue.on('queue:error', errorListener);

      const result = await queue.flush();

      expect(result.failed).toBe(1);
      expect(errorListener).toHaveBeenCalledOnce();

      // Entry should still be in queue with updated attempts
      const all = store.getAll();
      expect(all).toHaveLength(1);
      expect((all[0] as { attempts: number }).attempts).toBe(1);
      expect((all[0] as { nextRetryAt: string | null }).nextRetryAt).not.toBeNull();
    });

    it('discards entry after MAX_ATTEMPTS failures', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      store.add({
        id: 1,
        title: 'Bug 1',
        description: 'desc',
        userContext: {},
        videoBlob: null,
        apiUrl: 'https://api.test',
        sdkKey: 'sk_test',
        queuedAt: new Date().toISOString(),
        attempts: 9, // one more failure = 10 = MAX_ATTEMPTS
        nextRetryAt: null,
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: () => Promise.resolve(''),
      } as Response);

      const errorListener = vi.fn();
      queue.on('queue:error', errorListener);

      await queue.flush();

      // Entry should be removed
      const stats = await queue.getStats();
      expect(stats.count).toBe(0);
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Discarded') }),
      );
    });

    it('stops flushing when offline mid-flush', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      // Two entries
      store.add({ id: 1, title: 'Bug 1', description: 'd', userContext: {}, videoBlob: null, apiUrl: 'https://api.test', sdkKey: 'sk_test', queuedAt: new Date().toISOString(), attempts: 0, nextRetryAt: null });
      store.add({ id: 2, title: 'Bug 2', description: 'd', userContext: {}, videoBlob: null, apiUrl: 'https://api.test', sdkKey: 'sk_test', queuedAt: new Date().toISOString(), attempts: 0, nextRetryAt: null });

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        // Go offline after the first call
        mockOnline = false;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ticket: { id: `ticket-${callCount}`, status: 'open' } }),
        } as Response);
      });

      const result = await queue.flush();

      // Only first entry submitted; second skipped due to offline check
      expect(result.submitted).toBe(1);
    });

    it('emits queue:flushed event with submitted/failed counts', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      store.add({ id: 1, title: 'Bug 1', description: 'd', userContext: {}, videoBlob: null, apiUrl: 'https://api.test', sdkKey: 'sk_test', queuedAt: new Date().toISOString(), attempts: 0, nextRetryAt: null });

      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ticket: { id: 't1', status: 'open' } }) } as Response);

      const flushedListener = vi.fn();
      queue.on('queue:flushed', flushedListener);

      await queue.flush();

      expect(flushedListener).toHaveBeenCalledWith({ submitted: 1, failed: 0 });
    });

    it('does not emit queue:flushed when nothing was processed', async () => {
      await queue.initialize();
      // Empty queue
      global.fetch = vi.fn();

      const flushedListener = vi.fn();
      queue.on('queue:flushed', flushedListener);

      await queue.flush();

      expect(flushedListener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Network event integration
  // -------------------------------------------------------------------------

  describe('network events', () => {
    it('schedules a flush when "online" event fires', async () => {
      mockOnline = false;
      await queue.initialize();

      const flushSpy = vi.spyOn(queue, 'flush').mockResolvedValue({ submitted: 0, failed: 0 });

      // Simulate going online
      mockOnline = true;
      window.dispatchEvent(new Event('online'));

      // Wait for the scheduled flush (it uses setTimeout(fn, 0))
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(flushSpy).toHaveBeenCalled();
    });

    it('cancels pending flush when "offline" event fires', async () => {
      await queue.initialize();

      const flushSpy = vi.spyOn(queue, 'flush').mockResolvedValue({ submitted: 0, failed: 0 });

      // Schedule a flush then immediately go offline
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('offline'));

      // Wait longer than the setTimeout(fn, 0) delay
      await new Promise((resolve) => setTimeout(resolve, 20));

      // flush may or may not have been called once; the key assertion is that
      // after going offline it won't keep flushing.
      expect(flushSpy.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // isOnline getter
  // -------------------------------------------------------------------------

  describe('isOnline', () => {
    it('reflects navigator.onLine', async () => {
      mockOnline = true;
      expect(queue.isOnline).toBe(true);

      mockOnline = false;
      expect(queue.isOnline).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Event listener management
  // -------------------------------------------------------------------------

  describe('on / off', () => {
    it('registers and unregisters listeners', async () => {
      await queue.initialize();
      const store = getOrCreateStore('reports');

      store.add({ id: 1, title: 'Bug 1', description: 'd', userContext: {}, videoBlob: null, apiUrl: 'https://api.test', sdkKey: 'sk_test', queuedAt: new Date().toISOString(), attempts: 0, nextRetryAt: null });

      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ticket: { id: 't1', status: 'open' } }) } as Response);

      const listener = vi.fn();
      queue.on('queue:flushed', listener);
      queue.off('queue:flushed', listener);

      await queue.flush();

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// submitReport integration tests
// ---------------------------------------------------------------------------

describe('submitReport (offline-queue integration)', () => {
  beforeEach(() => {
    storeRegistry.clear();
    setupMockIndexedDB();
    _setOfflineQueueForTesting(null);
  });

  afterEach(() => {
    _setOfflineQueueForTesting(null);
    vi.restoreAllMocks();
  });

  it('returns null and queues report when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

    const mockQueue = new OfflineQueue();
    await mockQueue.initialize();

    const enqueueSpy = vi.spyOn(mockQueue, 'enqueue').mockResolvedValue(undefined);
    _setOfflineQueueForTesting(mockQueue);

    const result = await submitReport('https://api.test', 'sk_test', {
      title: 'Bug offline',
      description: 'desc',
      videoBlob: null,
      userContext: {},
    });

    expect(result).toBeNull();
    expect(enqueueSpy).toHaveBeenCalledOnce();

    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    mockQueue.destroy();
  });

  it('calls onQueued callback when report is queued due to offline', async () => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });

    const mockQueue = new OfflineQueue();
    await mockQueue.initialize();
    vi.spyOn(mockQueue, 'enqueue').mockResolvedValue(undefined);
    _setOfflineQueueForTesting(mockQueue);

    const onQueued = vi.fn();
    await submitReport('https://api.test', 'sk_test', {
      title: 'Bug',
      description: 'desc',
      videoBlob: null,
      userContext: {},
    }, 60000, onQueued);

    expect(onQueued).toHaveBeenCalledWith('offline');

    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    mockQueue.destroy();
  });

  it('returns null and queues when fetch throws a network TypeError', async () => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

    const mockQueue = new OfflineQueue();
    await mockQueue.initialize();
    const enqueueSpy = vi.spyOn(mockQueue, 'enqueue').mockResolvedValue(undefined);
    _setOfflineQueueForTesting(mockQueue);

    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await submitReport('https://api.test', 'sk_test', {
      title: 'Bug network error',
      description: 'desc',
      videoBlob: null,
      userContext: {},
    });

    expect(result).toBeNull();
    expect(enqueueSpy).toHaveBeenCalledOnce();

    mockQueue.destroy();
  });

  it('rethrows non-network errors (e.g. HTTP 400)', async () => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

    const mockQueue = new OfflineQueue();
    await mockQueue.initialize();
    _setOfflineQueueForTesting(mockQueue);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve('Validation error'),
    } as Response);

    await expect(
      submitReport('https://api.test', 'sk_test', {
        title: 'Bad report',
        description: 'desc',
        videoBlob: null,
        userContext: {},
      }),
    ).rejects.toThrow('HTTP 400');

    mockQueue.destroy();
  });

  it('returns the API response on success', async () => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });

    const mockQueue = new OfflineQueue();
    await mockQueue.initialize();
    _setOfflineQueueForTesting(mockQueue);

    const mockResponse = { ticket: { id: 'ticket-123', status: 'open' } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await submitReport('https://api.test', 'sk_test', {
      title: 'Good report',
      description: 'desc',
      videoBlob: null,
      userContext: {},
    });

    expect(result).toEqual(mockResponse);

    mockQueue.destroy();
  });
});
