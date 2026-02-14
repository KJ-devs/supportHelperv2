import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
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
  @ApiPropertyOptional({ description: 'GitHub agent mode (auto, manual, disabled)' })
  @IsOptional()
  @IsString()
  agentMode?: string;

  @ApiPropertyOptional({ description: 'Issue template name' })
  @IsOptional()
  @IsString()
  issueTemplate?: string;

  @ApiPropertyOptional({ description: 'Default issue labels (comma-separated)' })
  @IsOptional()
  @IsString()
  defaultLabels?: string;
}
