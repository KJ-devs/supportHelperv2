# Rate Limiting Guide

## Overview

The Support Helper API implements distributed rate limiting using Redis storage to protect against abuse and ensure fair resource allocation across tenants.

## Configuration

### Rate Limits by Endpoint Type

| Type | Endpoints | Limit | Window |
|------|-----------|-------|--------|
| **Public** | `/api/auth/register`, `/api/auth/login` | 10 requests | 1 minute |
| **Authenticated** | `/api/tickets/*` (dashboard) | 100 requests | 1 minute |
| **SDK** | `/api/sdk/tickets/*` | 50 requests | 1 minute |

### Environment Variables

```bash
# Optional: IP whitelist (comma-separated)
RATE_LIMIT_WHITELIST=127.0.0.1,::1,192.168.1.100
```

## Response Headers

All API responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1739468400
```

When rate limit is exceeded (HTTP 429):

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1739468460
Retry-After: 60

{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "ThrottlerException",
  "details": {
    "limit": 10,
    "resetTime": 1739468460,
    "retryAfter": 60
  }
}
```

## Client Implementation

### JavaScript/TypeScript

```typescript
async function makeRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);

  // Check rate limit headers
  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0');
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0');

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return makeRequest(url, options);
  }

  // Warn when approaching limit
  if (remaining < 10) {
    console.warn(`Approaching rate limit: ${remaining}/${limit} remaining`);
  }

  return response;
}
```

### SDK Integration

The web SDK automatically handles rate limiting:

```typescript
import { SupportHelper } from '@support-helper/sdk-web';

const supportHelper = new SupportHelper({
  sdkKey: 'your-sdk-key',
  apiUrl: 'https://api.example.com',
  retryOnRateLimit: true, // Auto-retry on 429
  maxRetries: 3,
});
```

## IP Whitelist

### Configuration

Add trusted IPs to bypass rate limiting (monitoring tools, health checks):

```bash
# .env
RATE_LIMIT_WHITELIST=127.0.0.1,::1,10.0.0.1,192.168.1.100
```

### Use Cases

- Internal monitoring services
- Load balancers health checks
- CI/CD deployment scripts
- Development environments

## Monitoring

### Logs

Rate limit violations are logged with `WARN` level:

```json
{
  "level": "warn",
  "message": "Rate limit exceeded for POST /api/auth/login - IP: 192.168.1.50",
  "context": {
    "method": "POST",
    "url": "/api/auth/login",
    "ip": "192.168.1.50",
    "userAgent": "Mozilla/5.0...",
    "limit": 10,
    "ttl": 60000
  }
}
```

Approaching limit warnings (< 10 remaining):

```json
{
  "level": "warn",
  "message": "Client approaching rate limit: 8/100 remaining",
  "context": {
    "method": "GET",
    "url": "/api/tickets",
    "ip": "192.168.1.100",
    "remaining": 8,
    "limit": 100
  }
}
```

### Metrics

Track rate limiting via:
- Sentry error tracking (429 responses)
- PostHog analytics (rate limit events)
- Redis monitoring (throttler keys)

## Troubleshooting

### Common Issues

#### 1. 429 Too Many Requests on First Call

**Cause:** Previous rate limit counter hasn't expired

**Solution:**
```bash
# Clear rate limit counters in Redis
redis-cli
> KEYS throttler:*
> DEL throttler:*
```

#### 2. Rate Limit Too Strict

**Temporary Fix:**
```bash
# Add your IP to whitelist
RATE_LIMIT_WHITELIST=127.0.0.1,::1,YOUR_IP
```

**Permanent Fix:** Adjust limits in `apps/api/src/app.module.ts`:
```typescript
{
  name: 'authenticated',
  ttl: 60000, // 1 minute
  limit: 200, // Increase from 100 to 200
}
```

#### 3. Distributed Setup Issues

**Problem:** Multiple API instances not sharing rate limits

**Verify:**
```bash
# Check Redis connection
redis-cli
> KEYS throttler:*
> TTL throttler:YOUR_KEY
```

**Fix:** Ensure all API instances connect to same Redis:
```bash
REDIS_URL=redis://shared-redis.example.com:6379
```

## Best Practices

### For API Consumers

1. **Check Headers:** Always read `X-RateLimit-*` headers
2. **Implement Backoff:** Wait `Retry-After` seconds on 429
3. **Cache Responses:** Reduce duplicate requests
4. **Batch Operations:** Combine multiple operations when possible
5. **Monitor Usage:** Track remaining quota in logs/metrics

### For API Developers

1. **Adjust Limits:** Monitor actual usage and adjust accordingly
2. **Whitelist Internal:** Add monitoring/deployment IPs
3. **Log Violations:** Investigate repeated 429s from same IP
4. **Test Limits:** Run load tests to verify behavior
5. **Document Limits:** Update API docs when changing limits

## Architecture

### Redis Storage

```
Key Format: throttler:{endpoint}:{ip}:{timestamp}
Value: Request count (integer)
TTL: 60000ms (1 minute)

Example:
Key: throttler:/api/tickets:192.168.1.100:1739468400
Value: 45
TTL: 15000ms (15 seconds remaining)
```

### Request Flow

```
1. Request arrives → ThrottlerGuard
2. Extract IP + endpoint → Generate Redis key
3. Redis INCR key → Get current count
4. Count > limit? → Return 429
5. Count ≤ limit? → Continue request
6. Response → Add X-RateLimit-* headers
7. RateLimitLoggingInterceptor → Check remaining
8. Remaining < 10? → Log warning
```

## Related Documentation

- [Authentication Guide](./AUTHENTICATION.md)
- [SDK Integration](../packages/sdk-web/README.md)
- [API Documentation](http://localhost:3001/api/docs)
