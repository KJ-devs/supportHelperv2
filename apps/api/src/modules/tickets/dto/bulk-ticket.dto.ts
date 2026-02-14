import { bulkTicketSchema, BulkTicketInput } from '../schemas/ticket.schema';

/**
 * DTO for bulk ticket operations
 * Validation is handled by Zod schema via ZodValidationPipe
 */
export type BulkTicketDto = BulkTicketInput;

export { bulkTicketSchema };
