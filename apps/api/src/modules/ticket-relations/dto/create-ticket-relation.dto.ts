import { IsEnum, IsString, IsUUID, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { TicketRelationType } from '@prisma/client';

export class CreateTicketRelationDto {
  @IsUUID()
  targetTicketId!: string;

  @IsEnum(TicketRelationType)
  relationType!: TicketRelationType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
