# Tenant Rate Limits

## Overview

Rate limits in Support Helper are configurable per tenant and support both per-minute and per-hour throttling. This feature allows fine-grained control over API usage based on tenant plans or custom requirements.

## Architecture

### Components

1. **TenantRateLimitGuard** - Enhanced throttler guard that reads tenant-specific limits from the database
2. **TenantsService** - Manages rate limit configuration CRUD operations
3. **TenantsController** - Exposes REST endpoints for rate limit management
4. **Migration** - Database migration to add default rate limits based on plan

### Storage

Rate limits are stored in the `tenants.settings` JSONB field:

```typescript
{
  "rateLimits": {
    "requestsPerMinute": 200,
    "requestsPerHour": 10000
  }
}
```

### Default Presets by Plan

| Plan       | Requests/Minute | Requests/Hour |
|------------|-----------------|---------------|
| Free       | 30              | 1,000         |
| Pro        | 200             | 10,000        |
| Enterprise | 1,000           | 50,000        |
| Default    | 100             | 5,000         |

## Usage

### Apply to Controllers

The `TenantRateLimitGuard` reads tenant configuration automatically:

```typescript
import { UseGuards } from '@nestjs/common';
import { TenantRateLimitGuard } from '../modules/auth/guards/tenant-rate-limit.guard';

@Controller('tickets')
@UseGuards(JwtAuthGuard, TenantRateLimitGuard)
export class TicketsController {
  @Post()
  async create() {
    // Rate limited per tenant
  }
}
```

### SDK Endpoints

SDK endpoints automatically use tenant limits based on the SDK key:

```typescript
@Controller('sdk/tickets')
@UseGuards(SdkKeyGuard, TenantRateLimitGuard)
export class SdkTicketsController {
  @Post('report')
  async report() {
    // Rate limited by tenant from SDK key
  }
}
```

## API Endpoints

### Get Current Tenant Rate Limits

```http
GET /api/tenants/current/rate-limits
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "requestsPerMinute": 200,
  "requestsPerHour": 10000
}
```

### Update Tenant Rate Limits (Admin Only)

```http
PATCH /api/tenants/:id/rate-limits
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "requestsPerMinute": 500,
  "requestsPerHour": 25000
}
```

**Response:**
```json
{
  "requestsPerMinute": 500,
  "requestsPerHour": 25000
}
```

**Notes:**
- Partial updates supported (can update only minute or hour limit)
- Requires `owner` or `admin` role, or updating own tenant
- Limits validated: 1-10,000 req/min, 1-500,000 req/hour

### Reset Rate Limits to Plan Defaults

```http
POST /api/tenants/:id/rate-limits/reset
Authorization: Bearer <jwt>
```

**Response:**
```json
{
  "requestsPerMinute": 200,
  "requestsPerHour": 10000
}
```

**Notes:**
- Resets to plan-based preset (free, pro, enterprise)
- Requires `owner` or `admin` role, or resetting own tenant

## Implementation Details

### Caching

The `TenantRateLimitGuard` includes a built-in 1-minute cache to reduce database load:

- Cache key: `tenantId`
- TTL: 60 seconds
- LRU eviction: max 1,000 entries

This means rate limit changes take up to 1 minute to propagate to all API instances.

### Rate Limit Keys

Redis keys are scoped by tenant:

- Per-minute: `tenant:{tenantId}:per-minute:*`
- Per-hour: `tenant:{tenantId}:per-hour:*`

This ensures isolation between tenants and allows custom limits per tenant.

### Response Headers

Rate limit information is exposed in response headers:

- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in window
- `X-RateLimit-Reset` - Timestamp when limit resets
- `Retry-After` - Seconds to wait when rate limited (429 response)

### Error Handling

When rate limit is exceeded, the API returns:

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

## Testing

### Unit Tests

```bash
pnpm --filter @support-helper/api test tenant-rate-limit.guard.spec.ts
pnpm --filter @support-helper/api test tenants.service.spec.ts
```

### Integration Testing

1. Create a test tenant with custom limits:

```bash
curl -X PATCH http://localhost:3001/api/tenants/{id}/rate-limits \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"requestsPerMinute": 5}'
```

2. Make rapid requests and observe 429 responses after 5 requests within 60 seconds.

3. Verify rate limit headers in responses.

## Migration

The migration `20260216260000_add_tenant_rate_limits` adds default rate limits to existing tenants based on their plan.

To run the migration:

```bash
pnpm db:migrate
```

To rollback (if needed):

```bash
pnpm db:migrate:rollback
```

## Best Practices

1. **Set limits per plan**: Use plan-based presets for consistency
2. **Custom limits for power users**: Override for enterprise customers with high volume
3. **Monitor usage**: Track rate limit hits in metrics/logs
4. **Gradual rollout**: Test new limits with a subset of tenants first
5. **Document limits**: Communicate rate limits in API documentation and dashboards

## Future Enhancements

- [ ] Rate limit analytics dashboard
- [ ] Burst allowances (allow temporary spikes)
- [ ] Per-endpoint rate limits (e.g., different limits for SDK vs dashboard)
- [ ] Dynamic rate limiting based on load
- [ ] Rate limit quota alerts for tenants approaching limits
