# Rate Limiting Implementation

## Overview

The Support Helper API implements tiered rate limiting using NestJS Throttler with Redis storage for distributed rate limiting across multiple application instances.

## Rate Limit Tiers

### Public Endpoints
- **Limit**: 10 requests per minute per IP address
- **Use case**: Login, register, public webhooks
- **Guard**: `PublicThrottlerGuard`
- **Decorator**: `@PublicRateLimit()`

### Authenticated Endpoints
- **Limit**: 100 requests per minute per user
- **Use case**: Dashboard API endpoints
- **Guard**: `JwtThrottlerGuard`
- **Decorator**: `@AuthenticatedRateLimit()`

### SDK Endpoints
- **Limit**: 50 requests per minute per SDK key
- **Use case**: Client SDK ticket submission
- **Guard**: `SdkThrottlerGuard`
- **Decorator**: `@SdkRateLimit()`

## Architecture

### Redis Storage
- Uses `@nest-lab/throttler-storage-redis` for distributed rate limiting
- Shared Redis instance with BullMQ queues
- Configurable via `REDIS_URL` environment variable

### Custom Guards
Located in `apps/api/src/common/throttler/`:

1. **PublicThrottlerGuard** - Tracks by IP address
2. **JwtThrottlerGuard** - Tracks by authenticated user ID
3. **SdkThrottlerGuard** - Tracks by SDK key from `x-sdk-key` header

### Exception Handling
- **ThrottlerExceptionFilter** - Custom exception filter
  - Returns 429 Too Many Requests
  - Logs rate limit events to Sentry
  - Adds rate limit headers to response

## Usage

### Applying Rate Limits to Controllers

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRateLimit } from '../common/throttler';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
@AuthenticatedRateLimit()
export class TicketsController {
  @Get()
  findAll() {
    // 100 requests per minute per user
  }
}
```

### SDK Endpoints

```typescript
import { Controller, Post } from '@nestjs/common';
import { SdkAuth } from '../common/decorators/sdk-auth.decorator';
import { SdkRateLimit } from '../common/throttler';

@Controller('sdk/tickets')
export class SdkTicketsController {
  @Post('report')
  @SdkAuth()
  @SdkRateLimit()
  async report() {
    // 50 requests per minute per SDK key
  }
}
```

### Public Endpoints

```typescript
import { Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PublicRateLimit } from '../common/throttler';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()
  @PublicRateLimit()
  async login() {
    // 10 requests per minute per IP
  }
}
```

### Skipping Rate Limits

```typescript
import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '../common/throttler';

@Controller('health')
export class HealthController {
  @Get()
  @SkipThrottle()
  check() {
    // No rate limit
  }
}
```

## Response Format

When rate limit is exceeded, the API returns:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "ThrottlerException: Too Many Requests",
  "timestamp": "2026-02-12T18:30:00.000Z",
  "path": "/api/tickets"
}
```

## Configuration

### Environment Variables
- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379`)

### Module Configuration
Located in `apps/api/src/app.module.ts`:

```typescript
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const redisUrl = config.get<string>('database.redisUrl') || 'redis://localhost:6379';
    const redis = new Redis(redisUrl);

    return {
      throttlers: [
        { name: 'public', ttl: 60000, limit: 10 },
        { name: 'authenticated', ttl: 60000, limit: 100 },
        { name: 'sdk', ttl: 60000, limit: 50 },
      ],
      storage: new ThrottlerStorageRedisService(redis),
    };
  },
}),
```

## Monitoring

### Sentry Integration
Rate limit events are automatically logged to Sentry with:
- Endpoint path
- HTTP method
- Client IP address
- Rate limit configuration (limit, ttl)

### Metrics
Monitor rate limiting effectiveness:
- 429 error count by endpoint
- IP addresses frequently hitting limits
- SDK keys with excessive requests

## Testing

### Manual Testing
Use curl or Postman to send multiple requests:

```bash
# Test public endpoint
for i in {1..15}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}'
  echo ""
done

# Test SDK endpoint
for i in {1..60}; do
  curl -X POST http://localhost:3001/api/sdk/tickets/report \
    -H "x-sdk-key: your-sdk-key" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test ticket"}'
  echo ""
done
```

### Expected Behavior
- First N requests (10/50/100 depending on tier) succeed with 200/201
- Subsequent requests within 1 minute return 429
- After 1 minute, rate limit resets

## Future Enhancements

1. **Dynamic Rate Limits** - Adjust limits based on user tier or subscription
2. **Rate Limit Headers** - Add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
3. **Burst Allowance** - Allow short bursts above the limit
4. **IP Whitelist** - Skip rate limiting for trusted IPs
5. **Custom Error Messages** - Provide more context in rate limit errors
