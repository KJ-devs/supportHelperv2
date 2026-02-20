import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z.string().min(1),
  type: z.string().optional().default('user'),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateMessageDto = z.infer<typeof createMessageSchema>;
