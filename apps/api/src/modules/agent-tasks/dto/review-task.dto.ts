import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveTaskDto {
  @ApiProperty({ enum: ['plan', 'code'], description: 'Which phase to approve' })
  @IsEnum(['plan', 'code'])
  phase: 'plan' | 'code';
}

export class RejectTaskDto {
  @ApiProperty({ enum: ['plan', 'code'], description: 'Which phase to reject' })
  @IsEnum(['plan', 'code'])
  phase: 'plan' | 'code';

  @ApiPropertyOptional({ description: 'Reason for rejection' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Whether to iterate on the plan instead of failing. Defaults to true for plan phase.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  iterate?: boolean;
}
