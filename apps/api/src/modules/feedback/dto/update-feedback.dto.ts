import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ description: 'Original AI-assigned value', example: 'bug' })
  @IsOptional()
  @IsString()
  originalValue?: string;

  @ApiPropertyOptional({ description: 'Human-corrected value', example: 'feature_request' })
  @IsOptional()
  @IsString()
  correctedValue?: string;
}
