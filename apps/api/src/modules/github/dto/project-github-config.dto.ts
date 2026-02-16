import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum } from 'class-validator';
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
}
