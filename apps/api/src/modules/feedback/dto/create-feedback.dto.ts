import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Ticket ID this feedback is for', format: 'uuid' })
  @IsUUID()
  ticketId: string;

  @ApiProperty({ description: 'Classification field being corrected', example: 'type' })
  @IsString()
  field: string;

  @ApiPropertyOptional({ description: 'Original AI-assigned value', example: 'bug' })
  @IsOptional()
  @IsString()
  originalValue?: string;

  @ApiPropertyOptional({ description: 'Human-corrected value', example: 'feature_request' })
  @IsOptional()
  @IsString()
  correctedValue?: string;
}
