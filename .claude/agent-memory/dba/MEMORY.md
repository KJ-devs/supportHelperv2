# DBA Agent Memory - supportHelperv2

## Database Package Structure

### Location
- Source: `packages/database/src/`
- Schema: `apps/api/prisma/schema.prisma`
- Build output: `packages/database/dist/`

### Files
- `src/client.ts` - Prisma client singleton (with HMR support)
- `src/schemas.ts` - Zod validation schemas for all models
- `src/index.ts` - Package exports

## Schema Alignment Rules

### Type Mappings (Prisma → Zod)
- `String @db.VarChar(N)` → `z.string().max(N)`
- `String? @db.VarChar(N)` → `z.string().max(N).nullable()`
- `Json` → `z.record(z.unknown())`
- `Json?` → `z.record(z.unknown()).nullable()`
- `String[]` → `z.array(z.string())`
- `Decimal(3,2)` → `decimalSchema` (custom union with Decimal class)
- `BigInt` → `z.bigint()`
- `DateTime` → `z.date()`
- `Int` → `z.number().int()`
- `Boolean` → `z.boolean()`

### Enum Strategy
Prisma models use plain `String` fields (not enum types) for flexibility.
Zod schemas define strict enums for validation but keep model schemas as strings to match Prisma.

Example:
```typescript
// Validation enum (for API input)
export const TicketStatusSchema = z.enum(['new', 'triaged', 'in_progress', 'waiting', 'resolved', 'closed']);

// Model schema (matches Prisma)
export const TicketSchema = z.object({
  status: z.string().max(50).default('new'), // String, not enum
  // ...
});
```

### Schema Coverage
All Prisma models MUST have corresponding Zod schemas:
- Model schema (full field set)
- Create schema (omits: id, timestamps, AI fields)
- Update schema (partial Create, omits tenantId)

Current coverage:
- Tenant ✅
- User ✅
- Application ✅
- Ticket ✅
- Media ✅
- VideoEvent ✅
- GithubConnection ✅
- GithubIssue ✅
- Integration ✅
- IntegrationSyncLog ✅
- AgentSession ✅
- AgentMessage ✅
- ClassificationFeedback ✅

## Strict Mode Compliance

### tsconfig Inheritance
`packages/database/tsconfig.json` extends `tsconfig.base.json`:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noUncheckedIndexedAccess: true`

### Type Safety Rules
- NO `any` types
- NO `@ts-ignore` comments
- Explicit nullable handling with `.nullable()`
- Default values match Prisma defaults

## Known Issues Fixed (Phase 4)

### 1. Missing Fields in Ticket Schema
Added to TicketSchema:
- `assignedTo: z.string().uuid().nullable()`
- `assignedAt: z.date().nullable()`
- `resolvedAt: z.date().nullable()`

### 2. Decimal Type Handling
Created custom `decimalSchema` for Prisma Decimal fields:
```typescript
const decimalSchema = z
  .union([
    z.instanceof(Decimal),
    z.number(),
    z.string().transform((val) => new Decimal(val)),
  ])
  .transform((val) => {
    if (val instanceof Decimal) return val;
    return new Decimal(val);
  });
```

### 3. reproductionSteps Type Mismatch
Changed from `z.array(z.string()).nullable()` to `z.record(z.unknown()).nullable()` to match Prisma `Json?`

### 4. GithubConnection.repos
Fixed from `z.record(z.unknown()).default([])` to `z.array(z.unknown()).default([])` to match Prisma `Json @default("[]")`

### 5. Enum vs String Fields
Separated validation enums from model field types:
- `TenantPlanSchema` for validation
- `TenantSchema.plan` as `z.string().max(50)` for model
- Same pattern for UserRole, TicketStatus, TicketType, etc.

## Build Validation

Command: `pnpm --filter @support-helper/database build`
Expected: Exit code 0, no TypeScript errors

Last validated: 2026-02-10 (Phase 4)
Status: ✅ All checks passing

## Future Considerations

- Add runtime validation helpers for API endpoints
- Consider Prisma middleware for automatic Zod validation
- Document migration strategy for enum additions
- Add JSDoc comments to exported types
