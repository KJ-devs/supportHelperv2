import { filterTicketsSchema, FilterTicketsInput } from '../schemas/ticket.schema';

/**
 * DTO for filtering and paginating tickets
 * Compatible with TanStack Query
 * Validation is handled by Zod schema via ZodValidationPipe
 */
export type FilterTicketsDto = FilterTicketsInput;

export { filterTicketsSchema };
