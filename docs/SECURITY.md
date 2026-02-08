# Security Documentation

Security considerations and best practices for Support Helper.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Data Protection](#data-protection)
- [API Security](#api-security)
- [Infrastructure Security](#infrastructure-security)
- [Compliance](#compliance)
- [Security Checklist](#security-checklist)
- [Incident Response](#incident-response)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)

## Overview

Support Helper handles sensitive data including bug reports, screen recordings, and user information. This document outlines security measures and best practices.

### Security Principles

1. **Defense in Depth** - Multiple layers of security
2. **Least Privilege** - Minimal necessary permissions
3. **Zero Trust** - Verify everything, trust nothing
4. **Secure by Default** - Security enabled out of the box

## Authentication

### JWT Authentication

Dashboard users authenticate with JWT tokens.

```typescript
// Token structure
{
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}
```

**Configuration:**
```env
JWT_SECRET=your-secret-key-at-least-32-characters
JWT_EXPIRES_IN=7d
```

**Best Practices:**
- Use strong, random JWT secrets (minimum 32 characters)
- Set appropriate expiration times
- Rotate secrets periodically
- Never expose secrets in client-side code

### SDK Key Authentication

SDK clients use API keys for authentication.

```
x-sdk-key: sk_live_abc123...
```

**Key Format:**
- `sk_live_` prefix for production
- `sk_test_` prefix for development
- 32+ character random string

**Best Practices:**
- Regenerate keys if compromised
- Use different keys per environment
- Monitor key usage for anomalies

### Password Security

```typescript
// Password hashing with bcrypt
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(password, SALT_ROUNDS);
const isValid = await bcrypt.compare(password, hash);
```

**Requirements:**
- Minimum 8 characters
- Recommended: 12+ characters
- Mix of uppercase, lowercase, numbers, symbols

## Authorization

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| `admin` | Full access, user management, settings |
| `manager` | Ticket management, assignments, reports |
| `member` | View and update assigned tickets |
| `viewer` | Read-only access |

### Multi-Tenant Isolation

Every database query is scoped to the user's tenant.

```typescript
// Example: All queries include tenantId
async findAll(tenantId: string) {
  return this.prisma.ticket.findMany({
    where: { tenantId },
  });
}
```

**Row-Level Security (RLS):**
```sql
-- PostgreSQL RLS policy
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tickets
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Guard Implementation

```typescript
// JWT Auth Guard
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

// Tenant Guard
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceTenantId = request.params.tenantId;

    return user.tenantId === resourceTenantId;
  }
}
```

## Data Protection

### Encryption

**At Rest:**
- Database encryption via provider (PostgreSQL TDE)
- S3 server-side encryption (SSE-S3 or SSE-KMS)
- Redis encryption for cache data

**In Transit:**
- TLS 1.3 for all connections
- HTTPS enforced
- Database connections use SSL

```env
DATABASE_URL=postgresql://...?sslmode=require
```

### Sensitive Data Handling

**PII Detection:**
```typescript
// Automatic PII detection in video analysis
const sensitivePatterns = [
  /\b\d{3}-\d{2}-\d{4}\b/,  // SSN
  /\b\d{16}\b/,              // Credit card
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,  // Email
];

function detectPII(text: string): string[] {
  return sensitivePatterns
    .filter(pattern => pattern.test(text))
    .map(pattern => pattern.source);
}
```

**Data Masking:**
- Mask sensitive fields in logs
- Redact PII from AI analysis
- Anonymize data in exports

### Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| Video recordings | 90 days |
| Ticket data | 2 years |
| Logs | 30 days |
| Audit logs | 1 year |

**Automatic Cleanup:**
```typescript
// Scheduled job for data cleanup
@Cron('0 0 * * *') // Daily at midnight
async cleanupOldData() {
  const cutoffDate = subDays(new Date(), 90);

  await this.prisma.media.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });
}
```

## API Security

### Rate Limiting

```typescript
// NestJS Throttler configuration
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
  ],
})
export class AppModule {}

// Per-endpoint limits
@Throttle({ default: { limit: 10, ttl: 60 } })
@Post('login')
async login() {}
```

| Endpoint | Limit |
|----------|-------|
| Auth endpoints | 10/min |
| SDK endpoints | 100/min |
| File uploads | 20/min |
| General API | 200/min |

### Input Validation

```typescript
// Using class-validator
export class CreateTicketDto {
  @IsString()
  @Length(1, 500)
  @Transform(({ value }) => sanitizeHtml(value))
  title: string;

  @IsString()
  @MaxLength(10000)
  @Transform(({ value }) => sanitizeHtml(value))
  description: string;

  @IsUUID()
  applicationId: string;
}
```

**Validation Rules:**
- Validate all inputs
- Sanitize HTML content
- Limit string lengths
- Validate file types and sizes

### CORS Configuration

```typescript
// main.ts
app.enableCors({
  origin: process.env.DASHBOARD_URL,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,
  maxAge: 3600,
});
```

### Security Headers

```typescript
// Using Helmet middleware
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

### SQL Injection Prevention

Prisma ORM provides built-in protection:

```typescript
// Safe: Parameterized query
const ticket = await prisma.ticket.findFirst({
  where: { id: userInput },
});

// Unsafe: Raw query (avoid if possible)
// If needed, use Prisma.sql for parameterization
const result = await prisma.$queryRaw(
  Prisma.sql`SELECT * FROM tickets WHERE id = ${userInput}`
);
```

## Infrastructure Security

### Environment Variables

**Never commit secrets:**
```gitignore
# .gitignore
.env
.env.local
.env.production
*.pem
*.key
```

**Use secrets management:**
- Railway Secrets
- Vercel Environment Variables
- AWS Secrets Manager
- HashiCorp Vault

### Container Security

```dockerfile
# Dockerfile best practices
FROM node:20-alpine

# Run as non-root user
USER node

# Don't include dev dependencies
ENV NODE_ENV=production

# Use multi-stage builds
COPY --from=builder /app/dist ./dist
```

### Network Security

```yaml
# docker-compose.yml
services:
  api:
    networks:
      - internal
      - external

  postgres:
    networks:
      - internal  # Not exposed externally

networks:
  internal:
    internal: true
  external:
```

### Logging Security

```typescript
// Mask sensitive data in logs
const maskSensitiveData = (data: any) => {
  const masked = { ...data };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '***REDACTED***';
    }
  }

  return masked;
};
```

## Compliance

### GDPR Compliance

**User Rights:**
- Right to access (data export)
- Right to rectification
- Right to erasure (data deletion)
- Right to data portability

**Implementation:**
```typescript
// Data export endpoint
@Get('export')
async exportUserData(@CurrentUser() user: UserPayload) {
  return this.usersService.exportData(user.userId);
}

// Data deletion endpoint
@Delete('account')
async deleteAccount(@CurrentUser() user: UserPayload) {
  await this.usersService.deleteAccount(user.userId);
}
```

### SOC 2 Considerations

- Access controls documented
- Encryption at rest and in transit
- Audit logging enabled
- Incident response procedures
- Regular security assessments

## Security Checklist

### Development

- [ ] Input validation on all endpoints
- [ ] Output encoding to prevent XSS
- [ ] SQL injection prevention (parameterized queries)
- [ ] CSRF protection
- [ ] Secure session management
- [ ] Proper error handling (no stack traces in production)

### Authentication

- [ ] Strong password requirements
- [ ] JWT secret rotation capability
- [ ] Token expiration configured
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts

### Authorization

- [ ] RBAC implemented
- [ ] Tenant isolation enforced
- [ ] Resource ownership validation
- [ ] Principle of least privilege

### Data Protection

- [ ] Encryption at rest
- [ ] Encryption in transit (TLS)
- [ ] PII detection and masking
- [ ] Secure key management
- [ ] Data retention policies

### Infrastructure

- [ ] Security headers configured
- [ ] CORS properly restricted
- [ ] No secrets in code/logs
- [ ] Dependencies up to date
- [ ] Container security best practices

### Monitoring

- [ ] Security event logging
- [ ] Anomaly detection
- [ ] Alerting configured
- [ ] Regular security audits

## Incident Response

### Response Plan

1. **Identify** - Detect and confirm the incident
2. **Contain** - Limit damage and prevent spread
3. **Eradicate** - Remove the threat
4. **Recover** - Restore normal operations
5. **Learn** - Document and improve

### Contact Information

- Security Team: security@support-helper.com
- Emergency: [Phone number]
- Status Page: status.support-helper.com

### Incident Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | Data breach, service down | Immediate |
| High | Security vulnerability | 4 hours |
| Medium | Suspicious activity | 24 hours |
| Low | Minor security issue | 72 hours |

## Reporting Vulnerabilities

We take security seriously. If you discover a vulnerability:

### Responsible Disclosure

1. **Email**: security@support-helper.com
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Your suggested fix (optional)

### What to Expect

- Acknowledgment within 24 hours
- Regular updates on progress
- Credit in security advisories (if desired)
- No legal action for good-faith reports

### Scope

**In Scope:**
- support-helper.com and subdomains
- API endpoints
- SDK packages
- Mobile applications

**Out of Scope:**
- Social engineering attacks
- Physical attacks
- Denial of service attacks
- Third-party services

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
