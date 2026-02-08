import { searchTicketsSchema, SearchTicketsInput } from '../schemas/ticket.schema';

/**
 * DTO for Meilisearch full-text search
 * Validation is handled by Zod schema via ZodValidationPipe
 */
export type SearchTicketsDto = SearchTicketsInput;

export { searchTicketsSchema };
