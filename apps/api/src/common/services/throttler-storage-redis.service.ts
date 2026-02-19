import { Injectable, OnApplicationShutdown, InternalServerErrorException } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Redis-backed storage for @nestjs/throttler
 *
 * Implements distributed rate limiting across multiple API instances
 * using Redis as the storage backend.
 */
@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage, OnApplicationShutdown {
  constructor(private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const results = await this.redis
      .multi()
      .incr(key)
      .pttl(key)
      .exec();

    if (!results) {
      throw new InternalServerErrorException('Redis transaction failed');
    }

    const [[incrErr, totalHits], [pttlErr, timeToExpire]] = results;

    if (incrErr || pttlErr) {
      throw incrErr || pttlErr;
    }

    // Set TTL on first increment (timeToExpire === -1 means no TTL set)
    if (timeToExpire === -1) {
      await this.redis.pexpire(key, ttl);
    }

    const actualTtl = timeToExpire === -1 ? ttl : (timeToExpire as number);

    return {
      totalHits: totalHits as number,
      timeToExpire: actualTtl,
    };
  }
}
