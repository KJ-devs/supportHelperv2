import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ConnectRepoDto {
  @ApiProperty({ description: 'GitHub installation ID (numeric)' })
  @Type(() => Number)
  @IsInt()
  installationId: number;

  @ApiProperty({ description: 'Repository owner (user or organization)' })
  @IsString()
  @IsNotEmpty()
  owner: string;

  @ApiProperty({ description: 'Repository name' })
  @IsString()
  @IsNotEmpty()
  repo: string;

  @ApiPropertyOptional({ description: 'Default branch', default: 'main' })
  @IsOptional()
  @IsString()
  defaultBranch?: string = 'main';
}

export class UpdateProjectGithubSettingsDto {
  @ApiPropertyOptional({
    description: 'Agent autonomy mode: auto (no review), review_plan (review before code gen), review_all (review plan and code)',
    enum: ['auto', 'review_plan', 'review_all'],
  })
  @IsOptional()
  @IsEnum(['auto', 'review_plan', 'review_all'])
  agentMode?: 'auto' | 'review_plan' | 'review_all';

  @ApiPropertyOptional({ description: 'Issue template name' })
  @IsOptional()
  @IsString()
  issueTemplate?: string;

  @ApiPropertyOptional({ description: 'Default issue labels (comma-separated)' })
  @IsOptional()
  @IsString()
  defaultLabels?: string;

  @ApiPropertyOptional({ description: 'Max retry attempts for agent tasks', minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxRetries?: number;

  @ApiPropertyOptional({ description: 'Agent task timeout in minutes', minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  timeoutMinutes?: number;

  @ApiPropertyOptional({ description: 'Enable automatic PR merging' })
  @IsOptional()
  @IsBoolean()
  autoMergeEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Merge strategy for auto-merge',
    enum: ['squash', 'merge', 'rebase'],
  })
  @IsOptional()
  @IsEnum(['squash', 'merge', 'rebase'])
  mergeStrategy?: 'squash' | 'merge' | 'rebase';

  @ApiPropertyOptional({ description: 'Number of required reviews before merge', minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requiredReviews?: number;
}
