import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('database.redisUrl') || 'redis://localhost:6379';
        const url = new URL(redisUrl);

        return {
          store: redisStore,
          host: url.hostname,
          port: parseInt(url.port || '6379', 10),
          ttl: 300, // Default 5 min TTL (seconds)
          max: 1000, // Max cached items
          keyPrefix: 'sh:cache:',
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class RedisCacheModule {}
