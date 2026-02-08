import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Ticket schemas
export const ticketPriority = z.enum(['low', 'medium', 'high', 'urgent']);
export const ticketStatus = z.enum(['open', 'in_progress', 'resolved', 'closed']);
export const ticketCategory = z.enum(['bug', 'feature', 'question', 'billing', 'other']);

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be less than 5000 characters'),
  priority: ticketPriority,
  category: ticketCategory,
  customerEmail: z.string().email('Invalid email address'),
});

export const updateTicketSchema = z.object({
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be less than 200 characters')
    .optional(),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .optional(),
  status: ticketStatus.optional(),
  priority: ticketPriority.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

// Settings schemas
export const generalSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  timezone: z.string(),
  language: z.string(),
});

export const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  avatar: z.string().url().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
