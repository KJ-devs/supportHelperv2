import { z } from 'zod';

export const updateMessageActionSchema = z.object({
  actionState: z.enum(['approved', 'rejected']),
});

export type UpdateMessageActionDto = z.infer<typeof updateMessageActionSchema>;
