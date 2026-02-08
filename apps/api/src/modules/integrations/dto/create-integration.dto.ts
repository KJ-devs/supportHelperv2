import { z } from 'zod';

export const createIntegrationSchema = z.object({
  type: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  enabled: z.boolean().optional().default(true),
  config: z.record(z.any()),
  mappings: z.record(z.any()).optional(),
});

export type CreateIntegrationDto = z.infer<typeof createIntegrationSchema>;
