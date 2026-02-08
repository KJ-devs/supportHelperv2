import { createTicketSchema, CreateTicketInput } from '../schemas/ticket.schema';

/**
 * DTO for creating a ticket
 * Validation is handled by Zod schema via ZodValidationPipe
 */
export type CreateTicketDto = CreateTicketInput;

export { createTicketSchema };
