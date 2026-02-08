import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════
// TENANT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  settings: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateTenantSchema = TenantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTenantSchema = CreateTenantSchema.partial();

// ═══════════════════════════════════════════════════════════════════════
// USER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const UserRoleSchema = z.enum(['admin', 'manager', 'member', 'viewer']);

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email().max(255),
  name: z.string().max(255).nullable(),
  role: UserRoleSchema.default('member'),
  passwordHash: z.string().max(255).nullable(),
  authProvider: z.string().max(50).nullable(),
  authProviderId: z.string().max(255).nullable(),
  createdAt: z.date(),
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  password: z.string().min(8).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({
  tenantId: true,
});

// ═══════════════════════════════════════════════════════════════════════
// APPLICATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const ApplicationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  platform: z.string().max(50).nullable(),
  sdkKey: z.string().max(255),
  settings: z.record(z.unknown()).default({}),
  githubRepo: z.string().max(255).nullable(),
  createdAt: z.date(),
});

export const CreateApplicationSchema = ApplicationSchema.omit({
  id: true,
  createdAt: true,
  sdkKey: true,
});

export const UpdateApplicationSchema = CreateApplicationSchema.partial().omit({
  tenantId: true,
});

// ═══════════════════════════════════════════════════════════════════════
// TICKET SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const TicketStatusSchema = z.enum([
  'new',
  'triaged',
  'in_progress',
  'waiting',
  'resolved',
  'closed',
]);

export const TicketTypeSchema = z.enum([
  'bug',
  'feature_request',
  'question',
  'documentation',
  'performance',
  'security',
]);

export const TicketSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export const TicketSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  applicationId: z.string().uuid(),
  reporterId: z.string().uuid().nullable(),
  status: TicketStatusSchema.default('new'),
  type: TicketTypeSchema.nullable(),
  typeConfidence: z.number().min(0).max(1).nullable(),
  severity: TicketSeveritySchema.nullable(),
  severityConfidence: z.number().min(0).max(1).nullable(),
  priority: z.number().int().default(0),
  title: z.string().max(500).nullable(),
  description: z.string().nullable(),
  reproductionSteps: z.array(z.string()).nullable(),
  userContext: z.record(z.unknown()).nullable(),
  sessionId: z.string().max(255).nullable(),
  aiSummary: z.string().nullable(),
  aiAnalysis: z.record(z.unknown()).nullable(),
  keywords: z.array(z.string()).default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateTicketSchema = TicketSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  aiSummary: true,
  aiAnalysis: true,
  typeConfidence: true,
  severityConfidence: true,
});

export const UpdateTicketSchema = CreateTicketSchema.partial();

// ═══════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════

export type Tenant = z.infer<typeof TenantSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;

export type Application = z.infer<typeof ApplicationSchema>;
export type CreateApplication = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplication = z.infer<typeof UpdateApplicationSchema>;

export type Ticket = z.infer<typeof TicketSchema>;
export type CreateTicket = z.infer<typeof CreateTicketSchema>;
export type UpdateTicket = z.infer<typeof UpdateTicketSchema>;
export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type TicketType = z.infer<typeof TicketTypeSchema>;
export type TicketSeverity = z.infer<typeof TicketSeveritySchema>;
