import { z } from 'zod';

export const upsertSatisfactionSchema = z
  .object({
    rating: z
      .number({
        required_error: 'Rating is required',
        invalid_type_error: 'Rating must be a number',
      })
      .int('Rating must be an integer')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating must be at most 5'),
    comment: z
      .string({
        invalid_type_error: 'Comment must be a string',
      })
      .max(2000, 'Comment must be at most 2000 characters')
      .optional(),
  })
  .strict();

export type UpsertSatisfactionInput = z.infer<typeof upsertSatisfactionSchema>;

export class UpsertSatisfactionDto implements UpsertSatisfactionInput {
  rating: number;
  comment?: string;
}
