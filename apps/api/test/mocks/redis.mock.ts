/**
 * Redis Mock for Testing
 *
 * Provides mock implementations of Redis operations.
 */

import { vi } from 'vitest';

const mockRedisStore = new Map<string, { value: string; expireAt?: number }>();
const mockRedisHashes = new Map<string, Map<string, string>>();
const mockRedisLists = new Map<string, string[]>();
const mockRedisSets = new Map<string, Set<string>>();

export const mockRedisClient = {
  // String operations
  get: vi.fn().mockImplementation(async (key: string) => {
    const item = mockRedisStore.get(key);
    if (!item) return null;
    if (item.expireAt && Date.now() > item.expireAt) {
      mockRedisStore.delete(key);
      return null;
    }
    return item.value;
  }),

  set: vi.fn().mockImplementation(async (key: string, value: string) => {
    mockRedisStore.set(key, { value });
    return 'OK';
  }),

  setex: vi.fn().mockImplementation(async (key: string, seconds: number, value: string) => {
    mockRedisStore.set(key, {
      value,
      expireAt: Date.now() + seconds * 1000,
    });
    return 'OK';
  }),

  del: vi.fn().mockImplementation(async (...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (mockRedisStore.delete(key)) count++;
      if (mockRedisHashes.delete(key)) count++;
      if (mockRedisLists.delete(key)) count++;
      if (mockRedisSets.delete(key)) count++;
    }
    return count;
  }),

  incr: vi.fn().mockImplementation(async (key: string) => {
    const item = mockRedisStore.get(key);
    const newValue = (parseInt(item?.value || '0', 10) + 1).toString();
    mockRedisStore.set(key, { value: newValue, expireAt: item?.expireAt });
    return parseInt(newValue, 10);
  }),

  expire: vi.fn().mockImplementation(async (key: string, seconds: number) => {
    const item = mockRedisStore.get(key);
    if (item) {
      item.expireAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }),

  ttl: vi.fn().mockImplementation(async (key: string) => {
    const item = mockRedisStore.get(key);
    if (!item) return -2;
    if (!item.expireAt) return -1;
    return Math.max(0, Math.floor((item.expireAt - Date.now()) / 1000));
  }),

  keys: vi.fn().mockImplementation(async (pattern: string) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(mockRedisStore.keys()).filter(key => regex.test(key));
  }),

  // Hash operations
  hset: vi.fn().mockImplementation(async (key: string, fields: Record<string, string>) => {
    if (!mockRedisHashes.has(key)) {
      mockRedisHashes.set(key, new Map());
    }
    const hash = mockRedisHashes.get(key)!;
    for (const [field, value] of Object.entries(fields)) {
      hash.set(field, value);
    }
    return Object.keys(fields).length;
  }),

  hget: vi.fn().mockImplementation(async (key: string, field: string) => {
    return mockRedisHashes.get(key)?.get(field) ?? null;
  }),

  hgetall: vi.fn().mockImplementation(async (key: string) => {
    const hash = mockRedisHashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }),

  // List operations
  lpush: vi.fn().mockImplementation(async (key: string, ...values: string[]) => {
    if (!mockRedisLists.has(key)) {
      mockRedisLists.set(key, []);
    }
    const list = mockRedisLists.get(key)!;
    list.unshift(...values.reverse());
    return list.length;
  }),

  rpop: vi.fn().mockImplementation(async (key: string) => {
    const list = mockRedisLists.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() ?? null;
  }),

  llen: vi.fn().mockImplementation(async (key: string) => {
    return mockRedisLists.get(key)?.length ?? 0;
  }),

  // Set operations
  sadd: vi.fn().mockImplementation(async (key: string, ...members: string[]) => {
    if (!mockRedisSets.has(key)) {
      mockRedisSets.set(key, new Set());
    }
    const set = mockRedisSets.get(key)!;
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }),

  sismember: vi.fn().mockImplementation(async (key: string, member: string) => {
    return mockRedisSets.get(key)?.has(member) ? 1 : 0;
  }),

  // Connection
  quit: vi.fn().mockResolvedValue('OK'),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

// Reset function for tests
export function resetRedisMocks() {
  mockRedisStore.clear();
  mockRedisHashes.clear();
  mockRedisLists.clear();
  mockRedisSets.clear();

  Object.values(mockRedisClient).forEach(mock => {
    if (typeof mock.mockClear === 'function') {
      mock.mockClear();
    }
  });
}

// Factory function for Jest mocking
export function createMockRedis() {
  return vi.fn().mockImplementation(() => mockRedisClient);
}
