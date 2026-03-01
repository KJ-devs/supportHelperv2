import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import * as crypto from 'crypto';

/** TTL in seconds for each type of AI completion cache */
export const AI_CACHE_TTL = {
  /** Video transcript analysis — 1 hour */
  ANALYZE_VIDEO: 3600,
  /** User description processing — 1 hour */
  PROCESS_DESCRIPTION: 3600,
  /** Issue classification — 4 hours (classifications are stable) */
  CLASSIFY_ISSUE: 14400,
  /** Worker ticket classification — 4 hours */
  WORKER_CLASSIFY: 14400,
} as const;

const AI_CACHE_PREFIX = 'ai:completion:';

@Injectable()
export class AiCacheService {
  private readonly logger = new Logger(AiCacheService.name);
  private requests = 0;

  constructor(private readonly cache: CacheService) {}

  /**
   * Generate a deterministic cache key from the AI call parameters.
   * Uses SHA-256 hash of the concatenated inputs.
   */
  buildKey(params: {
    operation: string;
    prompt: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
  }): string {
    const raw = [
      params.operation,
      params.systemPrompt ?? '',
      params.prompt,
      params.model ?? '',
      String(params.temperature ?? ''),
    ].join('|');

    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return `${AI_CACHE_PREFIX}${params.operation}:${hash}`;
  }

  /**
   * Get a cached AI completion result, or call the factory and cache it.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    this.requests++;
    if (this.requests % 100 === 0) {
      const metrics = this.cache.getMetrics();
      this.logger.log(
        `AI cache metrics after ${this.requests} requests: ` +
          `hits=${metrics.hits}, misses=${metrics.misses}, hitRate=${metrics.hitRate}`,
      );
    }

    return this.cache.getOrSet<T>(key, ttlSeconds, factory);
  }

  /**
   * Invalidate a specific AI cache entry.
   */
  async invalidate(key: string): Promise<void> {
    await this.cache.del(key);
  }

  /**
   * Invalidate all AI completion caches (e.g. after model change).
   */
  async invalidateAll(): Promise<void> {
    await this.cache.invalidateByPrefix(AI_CACHE_PREFIX);
    this.logger.log('All AI completion caches invalidated');
  }
}
