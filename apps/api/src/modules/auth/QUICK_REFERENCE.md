# Auth Module - Quick Reference

Fast reference guide for using the authentication module.

---

## 🚀 Quick Start

### Import Everything
```typescript
import {
  JwtAuthGuard,
  ApiKeyGuard,
  ApiKeyAuthGuard,
  TenantGuard,
  TenantRateLimitGuard,
  CurrentUser,
  CurrentTenant,
  Public,
} from '@/modules/auth';
```

---

## 🔐 Authentication Methods

### JWT (Dashboard Users)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Use in requests:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key (SDK Clients)
```http
POST /api/sdk/tickets
x-api-key: your-sdk-key-here
Content-Type: application/json
```

---

## 🛡️ Protecting Routes

### Default (JWT Protected)
```typescript
@Controller('api/tickets')
export class TicketsController {
  // Automatically protected - no decorator needed
  @Get()
  list() { ... }
}
```

### Public Route
```typescript
@Public()
@Get('health')
healthCheck() { ... }
```

### SDK Route
```typescript
@UseGuards(ApiKeyGuard)
@Post('sdk/tickets')
createTicket() { ... }
```

### Tenant-Validated Route
```typescript
@UseGuards(JwtAuthGuard, TenantGuard)
@Get('settings')
getSettings() { ... }
```

### Rate-Limited SDK Route
```typescript
@UseGuards(ApiKeyGuard, TenantRateLimitGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Post('sdk/tickets')
createTicket() { ... }
```

---

## 🏷️ Getting User/Tenant Data

### Get Current User
```typescript
// Entire user object
@Get('profile')
getProfile(@CurrentUser() user: UserEntity) {
  console.log(user.id, user.email, user.tenantId, user.role);
}

// Specific property
@Get('email')
getEmail(@CurrentUser('email') email: string) {
  return email;
}
```

### Get Current Tenant
```typescript
// Entire tenant object
@Get('settings')
getSettings(@CurrentTenant() tenant: TenantEntity) {
  console.log(tenant.id, tenant.name, tenant.plan);
}

// Just tenant ID
@Get('data')
getData(@CurrentTenant('id') tenantId: string) {
  return this.service.findByTenant(tenantId);
}
```

### Combined
```typescript
@Get('my-data')
getMyData(
  @CurrentUser('id') userId: string,
  @CurrentTenant('id') tenantId: string,
) {
  return this.service.find(tenantId, userId);
}
```

---

## 📋 Common Patterns

### Pattern 1: Dashboard CRUD Endpoint
```typescript
@Controller('api/resources')
export class ResourcesController {
  @Get()
  list(@CurrentTenant('id') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Post()
  create(
    @Body() dto: CreateDto,
    @CurrentUser('id') userId: string,
    @CurrentTenant('id') tenantId: string,
  ) {
    return this.service.create(dto, tenantId, userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentTenant('id') tenantId: string,
  ) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDto,
    @CurrentTenant('id') tenantId: string,
  ) {
    return this.service.update(id, dto, tenantId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentTenant('id') tenantId: string,
  ) {
    return this.service.remove(id, tenantId);
  }
}
```

### Pattern 2: SDK Endpoint
```typescript
@Controller('api/sdk')
@UseGuards(ApiKeyGuard)
export class SdkController {
  @Post('events')
  @Throttle({ default: { limit: 1000, ttl: 60000 } })
  async trackEvent(
    @Body() dto: EventDto,
    @CurrentTenant('id') tenantId: string,
  ) {
    return this.analyticsService.track(dto, tenantId);
  }
}
```

### Pattern 3: Admin-Only Endpoint
```typescript
@Controller('api/admin')
export class AdminController {
  @Get('users')
  async listUsers(
    @CurrentUser() user: UserEntity,
    @CurrentTenant('id') tenantId: string,
  ) {
    // Check admin role
    if (!['owner', 'admin'].includes(user.role)) {
      throw new ForbiddenException('Admin access required');
    }

    return this.usersService.findAll(tenantId);
  }
}
```

### Pattern 4: Public + Authenticated Endpoints
```typescript
@Controller('api/posts')
export class PostsController {
  // Public - anyone can view
  @Public()
  @Get()
  listPublic() {
    return this.service.findPublic();
  }

  // Protected - only authenticated users
  @Post()
  create(
    @Body() dto: CreatePostDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }
}
```

---

## 🔒 Role-Based Access

```typescript
// Custom decorator (create in decorators folder)
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Custom guard (create in guards folder)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user.role);
  }
}

// Usage
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
@Delete('users/:id')
deleteUser() { ... }
```

---

## ⚡ Rate Limiting

### Route-Level (IP-Based)
```typescript
@Throttle({ short: { limit: 5, ttl: 60000 } })
@Post('login')
login() { ... }
```

### Tenant-Level (SDK)
```typescript
@UseGuards(ApiKeyGuard, TenantRateLimitGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Post('sdk/tickets')
createTicket() { ... }
```

### Multiple Limits
```typescript
@Throttle({
  short: { limit: 3, ttl: 1000 },      // 3/second
  medium: { limit: 30, ttl: 60000 },   // 30/minute
  long: { limit: 100, ttl: 3600000 },  // 100/hour
})
@Post('expensive-operation')
doWork() { ... }
```

---

## 🧪 Testing

### Mock User
```typescript
const mockUser: UserEntity = {
  id: 'user-id',
  tenantId: 'tenant-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  tenant: {
    id: 'tenant-id',
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'free',
  },
};

// In test
const result = await controller.method(mockUser);
```

### Mock AuthService
```typescript
const mockAuthService = {
  login: jest.fn().mockResolvedValue({
    user: { ... },
    accessToken: 'token',
    refreshToken: 'refresh',
  }),
  register: jest.fn(),
  refresh: jest.fn(),
  validateUser: jest.fn(),
};
```

---

## 🛠️ Troubleshooting

### Issue: "Unauthorized" on protected route
**Solution:** Ensure JWT token is sent in `Authorization: Bearer <token>` header

### Issue: Route not protected
**Solution:** Check if `@Public()` decorator is applied accidentally

### Issue: Rate limit not working
**Solution:** Ensure `@nestjs/throttler` is configured in app module

### Issue: Tenant isolation not working
**Solution:**
1. Check TenantContextMiddleware is applied
2. Verify RLS policies are enabled in database
3. Ensure services filter by tenantId

### Issue: SQL injection in tenant context
**Solution:** ✅ Fixed - now uses parameterized queries

---

## 📚 Type Reference

### UserEntity
```typescript
{
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  tenant?: TenantEntity;
}
```

### TenantEntity
```typescript
{
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  settings?: any;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### JwtPayload
```typescript
{
  sub: string;        // userId
  email: string;
  tenantId: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
```

---

## 🔗 Related Modules

- **Tickets Module:** Uses `@CurrentTenant()` for tenant isolation
- **Media Module:** Uses `@CurrentTenant()` for upload validation
- **Users Module:** Uses `@CurrentUser()` for user management
- **Applications Module:** Manages SDK keys for `ApiKeyGuard`

---

## 📖 Full Documentation

See `README.md` for complete documentation and architectural details.
