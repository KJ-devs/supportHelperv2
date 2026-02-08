# Authentication Module

Complete multi-tenant authentication system for Support Helper Platform.

## Features

- **JWT Authentication** - For dashboard users (email/password login)
- **API Key Authentication** - For SDK clients (x-api-key header)
- **Multi-tenant Isolation** - Automatic tenant context management
- **Row-Level Security** - PostgreSQL session variable injection
- **Refresh Tokens** - Long-lived token renewal
- **Rate Limiting** - Per-tenant rate limiting for API keys

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Request                       │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    JWT Bearer            x-api-key header
         │                       │
   JwtAuthGuard            ApiKeyGuard
         │                       │
    JwtStrategy          ApiKeyStrategy
         │                       │
         └───────────┬───────────┘
                     │
          request.user = UserEntity | ApplicationEntity
                     │
          ┌──────────┴──────────┐
          │  TenantGuard        │ (optional)
          │  Validates tenantId │
          └──────────┬──────────┘
                     │
          ┌──────────┴──────────────────┐
          │ TenantContextMiddleware     │
          │ SET LOCAL app.current_tenant_id
          └──────────┬──────────────────┘
                     │
               Controller Method
                     │
          @CurrentUser() / @CurrentTenant()
```

## Usage

### 1. Protecting Dashboard Routes (JWT)

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, CurrentTenant } from '@/modules/auth';
import { UserEntity, TenantEntity } from '@/modules/auth/dto/auth.dto';

@Controller('api/tickets')
export class TicketsController {
  // Automatically protected by global JwtAuthGuard
  @Get()
  async listTickets(
    @CurrentUser() user: UserEntity,
    @CurrentTenant() tenant: TenantEntity,
  ) {
    // user.id, user.tenantId, user.role are available
    // tenant.id, tenant.name, tenant.plan are available
    return this.ticketsService.findAll(tenant.id);
  }

  // Access specific user property
  @Get('my-tickets')
  async getMyTickets(@CurrentUser('id') userId: string) {
    return this.ticketsService.findByUser(userId);
  }
}
```

### 2. Protecting SDK Routes (API Key)

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard, CurrentTenant } from '@/modules/auth';
import { TenantEntity } from '@/modules/auth/dto/auth.dto';

@Controller('api/sdk')
@UseGuards(ApiKeyGuard)
export class SdkController {
  @Post('tickets')
  async createTicket(
    @Body() dto: CreateTicketDto,
    @CurrentTenant() tenant: TenantEntity,
  ) {
    // Authenticated via x-api-key header
    // Tenant extracted from application.tenantId
    return this.ticketsService.create(dto, tenant.id);
  }
}
```

### 3. Public Routes (Skip Authentication)

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@/modules/auth';

@Controller('api/public')
export class PublicController {
  @Public()
  @Get('health')
  healthCheck() {
    // No authentication required
    return { status: 'ok' };
  }
}
```

### 4. Tenant-Aware Rate Limiting

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard, TenantRateLimitGuard } from '@/modules/auth';

@Controller('api/sdk')
@UseGuards(ApiKeyGuard, TenantRateLimitGuard)
export class SdkController {
  @Post('tickets')
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests/min per tenant
  async createTicket(@Body() dto: CreateTicketDto) {
    // Rate limited by tenantId, not IP
    return this.ticketsService.create(dto);
  }
}
```

### 5. Explicit Tenant Guard

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, TenantGuard, CurrentTenant } from '@/modules/auth';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AdminController {
  @Get('settings')
  getSettings(@CurrentTenant('id') tenantId: string) {
    // TenantGuard ensures tenantId is present
    return this.settingsService.find(tenantId);
  }
}
```

## API Endpoints

### POST /api/auth/register

Register new user and create tenant.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "tenantName": "Acme Inc"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "tenantId": "uuid",
    "email": "admin@example.com",
    "name": "John Doe",
    "role": "owner",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### POST /api/auth/login

Login with email and password.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePass123"
}
```

**Response:** Same as register

### POST /api/auth/refresh

Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:** Same as register/login

### GET /api/auth/me

Get current user info.

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "email": "admin@example.com",
  "name": "John Doe",
  "role": "owner",
  "tenant": {
    "id": "uuid",
    "name": "Acme Inc",
    "slug": "acme-inc",
    "plan": "free"
  }
}
```

## Decorators

### @CurrentUser()

Extract authenticated user from request.

```typescript
// Get entire user object
@CurrentUser() user: UserEntity

// Get specific property
@CurrentUser('id') userId: string
@CurrentUser('email') email: string
@CurrentUser('tenantId') tenantId: string
```

### @CurrentTenant()

Extract current tenant from request (works with both JWT and API Key auth).

```typescript
// Get entire tenant object
@CurrentTenant() tenant: TenantEntity

// Get specific property
@CurrentTenant('id') tenantId: string
@CurrentTenant('name') tenantName: string
```

### @Public()

Skip authentication for specific routes.

```typescript
@Public()
@Get('health')
healthCheck() { ... }
```

## Guards

### JwtAuthGuard

- Applied globally to all routes
- Validates JWT Bearer token
- Attaches user to request
- Skip with `@Public()` decorator

### ApiKeyGuard

- Validates `x-api-key` or `x-sdk-key` header
- Looks up application by SDK key
- Attaches application to request
- Use for SDK endpoints

### TenantGuard

- Ensures tenantId is present
- Validates tenant access
- Sets request.tenantId

### TenantRateLimitGuard

- Rate limits by tenantId instead of IP
- Use with `@Throttle()` decorator
- Useful for API key endpoints

## Environment Variables

```env
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=7d  # Access token expiry
```

## Row-Level Security (RLS)

The `TenantContextMiddleware` sets a PostgreSQL session variable that can be used in RLS policies:

```sql
-- Enable RLS on table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Create policy using session variable
CREATE POLICY tenant_isolation ON tickets
  USING (tenant_id::text = current_setting('app.current_tenant_id', TRUE));
```

The middleware executes:
```sql
SET LOCAL app.current_tenant_id = '<tenant-uuid>';
```

This provides database-level tenant isolation in addition to application-level filtering.

## Token Payload

### Access Token (JWT)
```typescript
{
  sub: string;        // User ID
  email: string;      // User email
  tenantId: string;   // Tenant ID
  role: 'owner' | 'admin' | 'member' | 'viewer';
  type: 'access';     // Token type
  iat: number;        // Issued at
  exp: number;        // Expires at (7 days default)
}
```

### Refresh Token (JWT)
```typescript
{
  sub: string;        // User ID
  email: string;      // User email
  tenantId: string;   // Tenant ID
  role: UserRole;
  type: 'refresh';    // Token type
  iat: number;        // Issued at
  exp: number;        // Expires at (30 days)
}
```

## Security Notes

1. **Password Hashing**: Uses bcrypt with 10 rounds
2. **Token Expiry**: Access tokens expire in 7 days, refresh tokens in 30 days
3. **Rate Limiting**:
   - Register: 3 req/min
   - Login: 5 req/min
   - Refresh: 10 req/min
4. **Multi-tenant Isolation**: Enforced at application and database level
5. **Slug Generation**: Tenant slugs auto-generated from name (URL-safe)

## Testing

See `auth.controller.spec.ts` for comprehensive test examples.

## Migration from Old Auth Module

If you have existing code using the old auth module at `src/auth/`, update imports:

```typescript
// Old
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { SdkKeyGuard } from '@/auth/guards/sdk-key.guard';

// New
import { JwtAuthGuard, ApiKeyGuard } from '@/modules/auth';
```

Note: `SdkKeyGuard` has been renamed to `ApiKeyGuard` for consistency.
