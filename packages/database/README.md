# @support-helper/database

Database schemas, client utilities, and Zod validation schemas for the Support Helper platform.

## Installation

This package is part of the monorepo workspace and installed automatically via pnpm.

```bash
pnpm install
```

## Contents

### Prisma Client Singleton

```typescript
import { prisma } from '@support-helper/database';

// Use the shared Prisma client
const user = await prisma.user.findUnique({
  where: { id: userId },
});
```

**Features**:
- Singleton pattern prevents multiple client instances
- HMR-safe (preserves client during development)
- Automatic query logging in development mode
- Configured for PostgreSQL with pgvector extension

### Zod Validation Schemas

All Prisma models have corresponding Zod schemas for runtime validation:

```typescript
import {
  TicketSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  type Ticket,
  type CreateTicket,
} from '@support-helper/database';

// Validate API input
const input = CreateTicketSchema.parse(requestBody);

// Type-safe data
const ticket: Ticket = await prisma.ticket.create({
  data: input,
});
```

## Schema Patterns

### Model Schemas

Full schema matching all Prisma model fields:

```typescript
import { UserSchema, type User } from '@support-helper/database';

// Validate a complete user object
const user: User = UserSchema.parse(data);
```

### Create Schemas

Omits auto-generated fields (id, timestamps):

```typescript
import { CreateUserSchema, type CreateUser } from '@support-helper/database';

// Validate input for creating a new user
const input: CreateUser = CreateUserSchema.parse(requestBody);

const newUser = await prisma.user.create({
  data: input,
});
```

### Update Schemas

Partial version of Create schema, omits immutable fields (tenantId):

```typescript
import { UpdateUserSchema, type UpdateUser } from '@support-helper/database';

// All fields optional
const updates: UpdateUser = UpdateUserSchema.parse(requestBody);

const updated = await prisma.user.update({
  where: { id: userId },
  data: updates,
});
```

## Available Schemas

### Core Models
- **Tenant**: `TenantSchema`, `CreateTenantSchema`, `UpdateTenantSchema`
- **User**: `UserSchema`, `CreateUserSchema`, `UpdateUserSchema`
- **Application**: `ApplicationSchema`, `CreateApplicationSchema`, `UpdateApplicationSchema`

### Tickets & Reports
- **Ticket**: `TicketSchema`, `CreateTicketSchema`, `UpdateTicketSchema`
- **Media**: `MediaSchema`, `CreateMediaSchema`, `UpdateMediaSchema`
- **VideoEvent**: `VideoEventSchema`, `CreateVideoEventSchema`

### Integrations
- **GithubConnection**: `GithubConnectionSchema`, `CreateGithubConnectionSchema`
- **GithubIssue**: `GithubIssueSchema`, `CreateGithubIssueSchema`
- **Integration**: `IntegrationSchema`, `CreateIntegrationSchema`, `UpdateIntegrationSchema`
- **IntegrationSyncLog**: `IntegrationSyncLogSchema`, `CreateIntegrationSyncLogSchema`

### AI Agent
- **AgentSession**: `AgentSessionSchema`, `CreateAgentSessionSchema`
- **AgentMessage**: `AgentMessageSchema`, `CreateAgentMessageSchema`

### Feedback
- **ClassificationFeedback**: `ClassificationFeedbackSchema`, `CreateClassificationFeedbackSchema`

## Enums

Validation enums for strict type checking:

```typescript
import {
  TenantPlanSchema,
  UserRoleSchema,
  TicketStatusSchema,
  TicketTypeSchema,
  TicketSeveritySchema,
  MediaProcessingStatusSchema,
  IntegrationTypeSchema,
  AgentSessionStatusSchema,
} from '@support-helper/database';

// Use for validation
const plan = TenantPlanSchema.parse('pro'); // 'free' | 'starter' | 'pro' | 'enterprise'
const role = UserRoleSchema.parse('admin'); // 'admin' | 'manager' | 'member' | 'viewer'
```

## Type Mappings

| Prisma Type | Zod Type | Notes |
|-------------|----------|-------|
| `String @db.VarChar(N)` | `z.string().max(N)` | Max length enforced |
| `String?` | `z.string().nullable()` | Explicit nullable |
| `Json` | `z.record(z.unknown())` | Generic JSON object |
| `Json?` | `z.record(z.unknown()).nullable()` | Nullable JSON |
| `String[]` | `z.array(z.string())` | Array of strings |
| `Decimal(3,2)` | `decimalSchema` | Custom Decimal handler |
| `BigInt` | `z.bigint()` | Native bigint |
| `DateTime` | `z.date()` | JavaScript Date |
| `Int` | `z.number().int()` | Integer constraint |
| `Boolean` | `z.boolean()` | Boolean |

## Special Types

### Decimal Fields

Fields like `typeConfidence` and `severityConfidence` use a custom schema that handles Prisma's Decimal type:

```typescript
import { TicketSchema, type Ticket } from '@support-helper/database';

// Accepts number, string, or Decimal
const ticket = TicketSchema.parse({
  // ...
  typeConfidence: 0.95, // number
  severityConfidence: "0.87", // string (converted to Decimal)
});
```

### JSON Fields

JSON fields like `metadata`, `userContext`, and `settings` use `z.record(z.unknown())`:

```typescript
import { ApplicationSchema } from '@support-helper/database';

const app = ApplicationSchema.parse({
  // ...
  settings: {
    theme: 'dark',
    notifications: true,
    customField: { nested: 'value' },
  },
});
```

## NestJS Integration

Use with NestJS DTOs for automatic validation:

```typescript
import { createZodDto } from 'nestjs-zod';
import { CreateTicketSchema } from '@support-helper/database';

export class CreateTicketDto extends createZodDto(CreateTicketSchema) {}

// In controller:
@Post()
async create(@Body() dto: CreateTicketDto) {
  return this.ticketsService.create(dto);
}
```

## Development

### Build

```bash
pnpm --filter @support-helper/database build
```

### Watch Mode

```bash
pnpm --filter @support-helper/database dev
```

### Run Tests

```bash
pnpm --filter @support-helper/database test
```

## Schema Source

The Prisma schema is located at `apps/api/prisma/schema.prisma`.

To regenerate the Prisma client after schema changes:

```bash
pnpm db:generate
```

## TypeScript Configuration

This package uses strict TypeScript mode:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noUncheckedIndexedAccess: true`

All schemas are fully type-safe with no `any` types.

## License

Private monorepo package - not published to npm.
