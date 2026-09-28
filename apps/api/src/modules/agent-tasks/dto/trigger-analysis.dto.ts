import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerAnalysisDto {
  @ApiPropertyOptional({
    description: 'AI model to use for analysis (overrides tenant default)',
    example: 'claude-sonnet-4-6',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Agent mode: autonomous runs without checkpoints, guided requires human approval',
    enum: ['autonomous', 'guided'],
    default: 'autonomous',
  })
  @IsOptional()
  @IsIn(['autonomous', 'guided'])
  agentMode?: 'autonomous' | 'guided';
}
