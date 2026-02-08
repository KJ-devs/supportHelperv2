import { assignTicketSchema, AssignTicketInput } from '../schemas/ticket.schema';

/**
 * DTO for assigning a ticket to a user
 * Validation is handled by Zod schema via ZodValidationPipe
 */
export type AssignTicketDto = AssignTicketInput;

export { assignTicketSchema };
