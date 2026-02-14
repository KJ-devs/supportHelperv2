import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  private hits = 0;
  private misses = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Get a value from cache.
   * Logs hit/miss metrics.
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cache.get<T>(key);
      if (value !== undefined && value !== null) {
        this.hits++;
        this.logger.debug(`Cache HIT: ${key} (hits=${this.hits}, misses=${this.misses})`);
        return value;
      }
      this.misses++;
      this.logger.debug(`Cache MISS: ${key} (hits=${this.hits}, misses=${this.misses})`);
      return undefined;
    } catch (error) {
      this.logger.warn(`Cache GET error for key ${key}: ${error}`);
      return undefined;
    }
  }

  /**
   * Set a value in cache with TTL (in seconds).
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      // cache-manager v7 uses milliseconds for TTL
      await this.cache.set(key, value, ttlSeconds * 1000);
    } catch (error) {
      this.logger.warn(`Cache SET error for key ${key}: ${error}`);
    }
  }

  /**
   * Delete a specific key from cache.
   */
  async del(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.logger.warn(`Cache DEL error for key ${key}: ${error}`);
    }
  }

  /**
   * Invalidate all cache keys matching a prefix pattern.
   * Uses Redis SCAN to find matching keys.
   */
  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      const store = (this.cache as any).store;
      if (store && typeof store.keys === 'function') {
        const keys: string[] = await store.keys(`sh:cache:${prefix}*`);
        if (keys.length > 0) {
          await Promise.all(keys.map((k: string) => this.cache.del(k)));
          this.logger.debug(`Invalidated ${keys.length} keys with prefix: ${prefix}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Cache invalidation error for prefix ${prefix}: ${error}`);
    }
  }

  /**
   * Get or set: returns cached value if present, otherwise calls factory and caches result.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Create a deterministic hash from filter parameters for use in cache keys.
   */
  hashFilters(filters: Record<string, unknown>): string {
    const sorted = JSON.stringify(filters, Object.keys(filters).sort());
    return crypto.createHash('md5').update(sorted).digest('hex').slice(0, 12);
  }

  /**
   * Get cache metrics for monitoring.
   */
  getMetrics() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
      total,
    };
  }
}
