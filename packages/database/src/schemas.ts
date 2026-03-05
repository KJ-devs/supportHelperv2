import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// ═══════════════════════════════════════════════════════════════════════
// TENANT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const TenantPlanSchema = z.enum(['free', 'starter', 'pro', 'enterprise']);

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  plan: TenantPlanSchema.default('free'),
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
  role: z.string().max(50).default('member'),
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

// Helper to transform Decimal to number (exported for reuse)
export const decimalSchema = z
  .union([z.instanceof(Decimal), z.number(), z.string().transform(val => new Decimal(val))])
  .transform(val => {
    if (val instanceof Decimal) {
      return val;
    }
    return new Decimal(val);
  });

// Confidence score (0-1)
const confidenceSchema = z
  .union([
    z.instanceof(Decimal),
    z.number().min(0).max(1),
    z.string().transform(val => new Decimal(val)),
  ])
  .transform(val => {
    if (val instanceof Decimal) {
      return val;
    }
    return new Decimal(val);
  })
  .refine(
    val => {
      const num = val instanceof Decimal ? parseFloat(val.toString()) : val;
      return num >= 0 && num <= 1;
    },
    { message: 'Confidence must be between 0 and 1' }
  );

export const TicketSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  applicationId: z.string().uuid(),
  reporterId: z.string().uuid().nullish(),
  status: z.string().max(50).default('new'),
  type: z.string().max(50).nullish(),
  typeConfidence: confidenceSchema.nullish(),
  severity: z.string().max(50).nullish(),
  severityConfidence: confidenceSchema.nullish(),
  priority: z.number().int().default(0),
  title: z.string().max(500).nullish(),
  description: z.string().nullish(),
  reproductionSteps: z.array(z.string()).nullish(),
  userContext: z.record(z.unknown()).nullish(),
  sessionId: z.string().max(255).nullish(),
  aiSummary: z.string().nullish(),
  aiAnalysis: z.record(z.unknown()).nullish(),
  keywords: z.array(z.string()).default([]),
  assignedTo: z.string().uuid().nullish(),
  assignedAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().nullish(),
});

export const CreateTicketSchema = TicketSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  aiSummary: true,
  aiAnalysis: true,
  typeConfidence: true,
  severityConfidence: true,
  assignedAt: true,
  resolvedAt: true,
});

export const UpdateTicketSchema = CreateTicketSchema.partial();

// ═══════════════════════════════════════════════════════════════════════
// MEDIA SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const MediaProcessingStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

export const MediaSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  type: z.string().max(50),
  storageKey: z.string().max(500),
  storageUrl: z.string().max(1000).nullable(),
  fileSize: z.bigint().nullable(),
  mimeType: z.string().max(100).nullable(),
  durationMs: z.number().int().nullable(),
  processingStatus: z.string().max(50).default('pending'),
  processingError: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export const CreateMediaSchema = MediaSchema.omit({
  id: true,
  createdAt: true,
});

export const UpdateMediaSchema = CreateMediaSchema.partial().omit({
  ticketId: true,
});

// ═══════════════════════════════════════════════════════════════════════
// VIDEO EVENT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const VideoEventSchema = z.object({
  id: z.string().uuid(),
  mediaId: z.string().uuid(),
  timestampMs: z.number().int(),
  eventType: z.string().max(50).nullable(),
  eventData: z.record(z.unknown()).nullable(),
  screenshotKey: z.string().max(500).nullable(),
  ocrText: z.string().nullable(),
  createdAt: z.date(),
});

export const CreateVideoEventSchema = VideoEventSchema.omit({
  id: true,
  createdAt: true,
});

// ═══════════════════════════════════════════════════════════════════════
// GITHUB SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const GithubConnectionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  installationId: z.bigint(),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  repos: z.array(z.unknown()).default([]),
  createdAt: z.date(),
});

export const CreateGithubConnectionSchema = GithubConnectionSchema.omit({
  id: true,
  createdAt: true,
});

export const GithubIssueSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid().nullable(),
  githubIssueNumber: z.number().int(),
  githubRepo: z.string().max(255),
  githubIssueUrl: z.string().max(500).nullable(),
  syncStatus: z.string().max(50).default('synced'),
  lastSyncedAt: z.date(),
  createdAt: z.date(),
});

export const CreateGithubIssueSchema = GithubIssueSchema.omit({
  id: true,
  createdAt: true,
  lastSyncedAt: true,
});

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const IntegrationTypeSchema = z.enum(['jira', 'hubspot', 'slack', 'notion']);

export const IntegrationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  type: z.string().max(50),
  name: z.string().max(255),
  enabled: z.boolean().default(true),
  config: z.string(),
  configIv: z.string().max(32),
  mappings: z.record(z.unknown()).nullable().default({}),
  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastSyncedAt: z.date().nullable(),
});

export const CreateIntegrationSchema = IntegrationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
});

export const UpdateIntegrationSchema = CreateIntegrationSchema.partial().omit({
  tenantId: true,
});

export const IntegrationSyncLogSchema = z.object({
  id: z.string().uuid(),
  integrationId: z.string().uuid(),
  ticketId: z.string().uuid(),
  externalId: z.string().max(500).nullable(),
  status: z.string().max(50),
  attemptCount: z.number().int().default(1),
  error: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable().default({}),
  syncedAt: z.date(),
});

export const CreateIntegrationSyncLogSchema = IntegrationSyncLogSchema.omit({
  id: true,
  syncedAt: true,
});

// ═══════════════════════════════════════════════════════════════════════
// AGENT SESSION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const AgentSessionStatusSchema = z.enum(['active', 'completed', 'escalated']);

export const AgentSessionSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  status: z.string().max(50).default('active'),
  agentState: z.record(z.unknown()).default({}),
  lastActionAt: z.date(),
  escalatedTo: z.string().uuid().nullable(),
  escalationReason: z.string().nullable(),
  agentLevel: z.string().max(50).nullable(),
  modelUsed: z.string().max(100).nullable(),
  agentMode: z.string().max(20).default('autonomous'),
  checkpointState: z.string().max(50).default('none'),
  createdAt: z.date(),
});

export const CreateAgentSessionSchema = AgentSessionSchema.omit({
  id: true,
  createdAt: true,
  lastActionAt: true,
});

export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: z.string().max(50),
  content: z.string(),
  channel: z.string().max(50).nullable(),
  externalId: z.string().max(255).nullable(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
});

export const CreateAgentMessageSchema = AgentMessageSchema.omit({
  id: true,
  createdAt: true,
});

// ═══════════════════════════════════════════════════════════════════════
// CLASSIFICATION FEEDBACK SCHEMAS
// ═══════════════════════════════════════════════════════════════════════

export const ClassificationFeedbackSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  field: z.string().max(50),
  originalValue: z.string().max(100).nullable(),
  correctedValue: z.string().max(100).nullable(),
  correctedBy: z.string().uuid().nullable(),
  createdAt: z.date(),
});

export const CreateClassificationFeedbackSchema = ClassificationFeedbackSchema.omit({
  id: true,
  createdAt: true,
});

// ═══════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════

export type TenantPlan = z.infer<typeof TenantPlanSchema>;
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

export type Media = z.infer<typeof MediaSchema>;
export type CreateMedia = z.infer<typeof CreateMediaSchema>;
export type UpdateMedia = z.infer<typeof UpdateMediaSchema>;
export type MediaProcessingStatus = z.infer<typeof MediaProcessingStatusSchema>;

export type VideoEvent = z.infer<typeof VideoEventSchema>;
export type CreateVideoEvent = z.infer<typeof CreateVideoEventSchema>;

export type GithubConnection = z.infer<typeof GithubConnectionSchema>;
export type CreateGithubConnection = z.infer<typeof CreateGithubConnectionSchema>;
export type GithubIssue = z.infer<typeof GithubIssueSchema>;
export type CreateGithubIssue = z.infer<typeof CreateGithubIssueSchema>;

export type Integration = z.infer<typeof IntegrationSchema>;
export type CreateIntegration = z.infer<typeof CreateIntegrationSchema>;
export type UpdateIntegration = z.infer<typeof UpdateIntegrationSchema>;
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;
export type IntegrationSyncLog = z.infer<typeof IntegrationSyncLogSchema>;
export type CreateIntegrationSyncLog = z.infer<typeof CreateIntegrationSyncLogSchema>;

export type AgentSession = z.infer<typeof AgentSessionSchema>;
export type CreateAgentSession = z.infer<typeof CreateAgentSessionSchema>;
export type AgentSessionStatus = z.infer<typeof AgentSessionStatusSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type CreateAgentMessage = z.infer<typeof CreateAgentMessageSchema>;

export type ClassificationFeedback = z.infer<typeof ClassificationFeedbackSchema>;
export type CreateClassificationFeedback = z.infer<typeof CreateClassificationFeedbackSchema>;
