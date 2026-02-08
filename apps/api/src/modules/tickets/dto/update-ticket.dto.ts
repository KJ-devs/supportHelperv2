import { updateTicketSchema, UpdateTicketInput } from '../schemas/ticket.schema';

/**
 * DTO for updating a ticket
 * Validation is handled by Zod schema via ZodValidationPipe
 */
export type UpdateTicketDto = UpdateTicketInput;

export { updateTicketSchema };
