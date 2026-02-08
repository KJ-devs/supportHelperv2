import { z } from 'zod';

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
  mappings: z.record(z.any()).optional(),
});

export type UpdateIntegrationDto = z.infer<typeof updateIntegrationSchema>;
