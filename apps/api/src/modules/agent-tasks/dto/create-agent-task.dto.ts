import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAgentTaskDto {
  @ApiProperty({ description: 'Ticket ID to analyze', format: 'uuid' })
  @IsUUID()
  ticketId: string;
}
