import { z } from 'zod';

// Ticket type enum
export const ticketTypeEnum = z.enum(['bug', 'feature', 'ui', 'performance']);
export type TicketType = z.infer<typeof ticketTypeEnum>;

// Ticket severity enum
export const ticketSeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export type TicketSeverity = z.infer<typeof ticketSeverityEnum>;

// Reproduction step schema
export const reproductionStepSchema = z.string().min(1, 'Step cannot be empty');

// New ticket form schema
export const newTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be less than 500 characters'),
  description: z.string().min(1, 'Description is required'),
  type: ticketTypeEnum,
  severity: ticketSeverityEnum,
  applicationId: z.string().uuid('Invalid application ID'),
  reproductionSteps: z.array(reproductionStepSchema).default([]),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        size: z.number(),
        type: z.string(),
        url: z.string().optional(),
        file: z.instanceof(File).optional(),
      })
    )
    .default([]),
});

export type NewTicketInput = z.infer<typeof newTicketSchema>;

// Default values for the form
export const defaultTicketValues: NewTicketInput = {
  title: '',
  description: '',
  type: 'bug',
  severity: 'medium',
  applicationId: '',
  reproductionSteps: [],
  attachments: [],
};

// Type labels for UI
export const ticketTypeLabels: Record<TicketType, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  ui: 'UI/UX Issue',
  performance: 'Performance Issue',
};

// Severity labels for UI
export const ticketSeverityLabels: Record<TicketSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

// Severity colors for UI
export const ticketSeverityColors: Record<TicketSeverity, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

// Auto severity mapping based on type
export const autoSeverityByType: Partial<Record<TicketType, TicketSeverity>> = {
  // Critical bugs default to high severity
};

// Function to determine if severity should be auto-set
export function shouldAutoSetSeverity(type: TicketType): TicketSeverity | null {
  return autoSeverityByType[type] ?? null;
}
