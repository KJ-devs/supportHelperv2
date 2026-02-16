import { z } from 'zod';

/**
 * Ticket status enum
 */
export const TICKET_STATUSES = [
  'new',
  'open',
  'in_progress',
  'pending',
  'resolved',
  'merged',
  'closed',
] as const;

/**
 * Ticket type enum
 */
export const TICKET_TYPES = [
  'bug',
  'feature_request',
  'question',
  'documentation',
  'performance',
  'security',
] as const;

/**
 * Ticket severity enum
 */
export const TICKET_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Sort fields enum
 */
export const SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'severity',
  'priority',
] as const;

/**
 * Sort orders enum
 */
export const SORT_ORDERS = ['asc', 'desc'] as const;

/**
 * Create ticket schema
 */
export const createTicketSchema = z
  .object({
    title: z
      .string({
        required_error: 'Title is required',
        invalid_type_error: 'Title must be a string',
      })
      .min(1, 'Title cannot be empty')
      .max(500, 'Title too long (max 500 characters)'),

    description: z
      .string({
        invalid_type_error: 'Description must be a string',
      })
      .optional(),

    applicationId: z
      .string({
        required_error: 'Application ID is required',
        invalid_type_error: 'Application ID must be a string',
      })
      .uuid('Application ID must be a valid UUID'),

    userContext: z
      .record(z.any(), {
        invalid_type_error: 'User context must be an object',
      })
      .optional(),

    reproductionSteps: z
      .union([z.array(z.string()), z.record(z.any())])
      .optional(),

    sessionId: z
      .string({
        invalid_type_error: 'Session ID must be a string',
      })
      .optional(),

    integrationOptions: z
      .object({
        enabled: z.boolean().optional(),
        exclude: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .strict();

/**
 * Update ticket schema
 */
export const updateTicketSchema = z
  .object({
    title: z
      .string({
        invalid_type_error: 'Title must be a string',
      })
      .min(1, 'Title cannot be empty')
      .max(500, 'Title too long (max 500 characters)')
      .optional(),

    description: z
      .string({
        invalid_type_error: 'Description must be a string',
      })
      .optional(),

    status: z
      .enum(TICKET_STATUSES, {
        errorMap: () => ({
          message: `Status must be one of: ${TICKET_STATUSES.join(', ')}`,
        }),
      })
      .optional(),

    type: z
      .enum(TICKET_TYPES, {
        errorMap: () => ({
          message: `Type must be one of: ${TICKET_TYPES.join(', ')}`,
        }),
      })
      .optional(),

    severity: z
      .enum(TICKET_SEVERITIES, {
        errorMap: () => ({
          message: `Severity must be one of: ${TICKET_SEVERITIES.join(', ')}`,
        }),
      })
      .optional(),

    reproductionSteps: z
      .union([z.array(z.string()), z.record(z.any())])
      .optional(),

    aiSummary: z
      .string({
        invalid_type_error: 'AI summary must be a string',
      })
      .optional(),

    aiAnalysis: z
      .record(z.any(), {
        invalid_type_error: 'AI analysis must be an object',
      })
      .optional(),
  })
  .strict();

/**
 * Filter tickets schema for listing with pagination
 * Compatible with TanStack Query
 */
export const filterTicketsSchema = z.object({
  // Pagination
  page: z
    .number({
      coerce: true,
      invalid_type_error: 'Page must be a number',
    })
    .int('Page must be an integer')
    .min(0, 'Page must be >= 0')
    .optional()
    .default(0),

  limit: z
    .number({
      coerce: true,
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .min(1, 'Limit must be >= 1')
    .max(100, 'Limit must be <= 100')
    .optional()
    .default(20),

  // Sorting
  sortBy: z
    .enum(SORT_FIELDS, {
      errorMap: () => ({
        message: `Sort field must be one of: ${SORT_FIELDS.join(', ')}`,
      }),
    })
    .optional()
    .default('createdAt'),

  sortOrder: z
    .enum(SORT_ORDERS, {
      errorMap: () => ({
        message: `Sort order must be one of: ${SORT_ORDERS.join(', ')}`,
      }),
    })
    .optional()
    .default('desc'),

  // Filters
  status: z
    .enum(TICKET_STATUSES, {
      errorMap: () => ({
        message: `Status must be one of: ${TICKET_STATUSES.join(', ')}`,
      }),
    })
    .optional(),

  type: z
    .enum(TICKET_TYPES, {
      errorMap: () => ({
        message: `Type must be one of: ${TICKET_TYPES.join(', ')}`,
      }),
    })
    .optional(),

  severity: z
    .enum(TICKET_SEVERITIES, {
      errorMap: () => ({
        message: `Severity must be one of: ${TICKET_SEVERITIES.join(', ')}`,
      }),
    })
    .optional(),

  applicationId: z
    .string({
      invalid_type_error: 'Application ID must be a string',
    })
    .uuid('Application ID must be a valid UUID')
    .optional(),

  assignedTo: z
    .string({
      invalid_type_error: 'Assigned to must be a string',
    })
    .uuid('Assigned to must be a valid UUID')
    .optional(),

  reporterId: z
    .string({
      invalid_type_error: 'Reporter ID must be a string',
    })
    .uuid('Reporter ID must be a valid UUID')
    .optional(),

  search: z
    .string({
      invalid_type_error: 'Search must be a string',
    })
    .optional(),

  createdFrom: z
    .string({
      invalid_type_error: 'Created from must be a date string',
    })
    .datetime('Created from must be a valid ISO 8601 date')
    .optional(),

  createdTo: z
    .string({
      invalid_type_error: 'Created to must be a date string',
    })
    .datetime('Created to must be a valid ISO 8601 date')
    .optional(),
});

/**
 * Search tickets schema for Meilisearch full-text search
 */
export const searchTicketsSchema = z.object({
  query: z
    .string({
      required_error: 'Search query is required',
      invalid_type_error: 'Query must be a string',
    })
    .min(1, 'Query cannot be empty'),

  limit: z
    .number({
      coerce: true,
      invalid_type_error: 'Limit must be a number',
    })
    .int('Limit must be an integer')
    .min(1, 'Limit must be >= 1')
    .max(100, 'Limit must be <= 100')
    .optional()
    .default(20),

  offset: z
    .number({
      coerce: true,
      invalid_type_error: 'Offset must be a number',
    })
    .int('Offset must be an integer')
    .min(0, 'Offset must be >= 0')
    .optional()
    .default(0),

  status: z
    .string({
      invalid_type_error: 'Status must be a string',
    })
    .regex(
      /^(new|open|in_progress|pending|resolved|closed)(,(new|open|in_progress|pending|resolved|closed))*$/,
      'Status must be comma-separated valid statuses',
    )
    .optional(),

  severity: z
    .string({
      invalid_type_error: 'Severity must be a string',
    })
    .regex(
      /^(critical|high|medium|low)(,(critical|high|medium|low))*$/,
      'Severity must be comma-separated valid severities',
    )
    .optional(),

  type: z
    .string({
      invalid_type_error: 'Type must be a string',
    })
    .regex(
      /^(bug|feature_request|question|documentation|performance|security)(,(bug|feature_request|question|documentation|performance|security))*$/,
      'Type must be comma-separated valid types',
    )
    .optional(),
});

/**
 * Assign ticket schema
 */
export const assignTicketSchema = z
  .object({
    userId: z
      .string({
        invalid_type_error: 'User ID must be a string',
      })
      .uuid('User ID must be a valid UUID')
      .nullable(),
  })
  .strict();

/**
 * Bulk action types
 */
export const BULK_ACTIONS = [
  'update_status',
  'assign',
  'unassign',
  'change_priority',
  'change_severity',
  'delete',
] as const;

/**
 * Bulk ticket operations schema
 */
export const bulkTicketSchema = z
  .object({
    ticketIds: z
      .array(
        z
          .string({ invalid_type_error: 'Each ticket ID must be a string' })
          .uuid('Each ticket ID must be a valid UUID'),
      )
      .min(1, 'At least one ticket ID is required')
      .max(100, 'Maximum 100 tickets per bulk operation'),

    action: z.enum(BULK_ACTIONS, {
      errorMap: () => ({
        message: `Action must be one of: ${BULK_ACTIONS.join(', ')}`,
      }),
    }),

    value: z.any().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    switch (data.action) {
      case 'update_status':
        if (
          !data.value ||
          typeof data.value !== 'string' ||
          !(TICKET_STATUSES as readonly string[]).includes(data.value)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `value must be a valid status: ${TICKET_STATUSES.join(', ')}`,
            path: ['value'],
          });
        }
        break;
      case 'assign':
        if (
          !data.value ||
          typeof data.value !== 'string' ||
          !z.string().uuid().safeParse(data.value).success
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'value must be a valid user UUID for assign action',
            path: ['value'],
          });
        }
        break;
      case 'change_priority':
        if (
          data.value === undefined ||
          data.value === null ||
          typeof data.value !== 'number' ||
          !Number.isInteger(data.value) ||
          data.value < 0 ||
          data.value > 10
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'value must be an integer between 0 and 10 for change_priority action',
            path: ['value'],
          });
        }
        break;
      case 'change_severity':
        if (
          !data.value ||
          typeof data.value !== 'string' ||
          !(TICKET_SEVERITIES as readonly string[]).includes(data.value)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `value must be a valid severity: ${TICKET_SEVERITIES.join(', ')}`,
            path: ['value'],
          });
        }
        break;
      case 'unassign':
      case 'delete':
        // No value required
        break;
    }
  });

/**
 * TypeScript types inferred from schemas
 */
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type FilterTicketsInput = z.infer<typeof filterTicketsSchema>;
export type SearchTicketsInput = z.infer<typeof searchTicketsSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type BulkTicketInput = z.infer<typeof bulkTicketSchema>;
