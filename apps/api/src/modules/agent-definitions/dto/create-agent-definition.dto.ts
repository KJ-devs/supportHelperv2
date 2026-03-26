import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  IsNumber,
  IsInt,
  IsBoolean,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDefinitionDto {
  @ApiProperty({ description: 'Agent name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Agent description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'System prompt for the agent' })
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiPropertyOptional({ description: 'List of tool names the agent can use' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolset?: string[];

  @ApiPropertyOptional({ description: 'JSON rules for when to trigger this agent' })
  @IsOptional()
  @IsObject()
  triggerRules?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'AI model identifier', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ description: 'Model temperature (0-1)', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Maximum iterations for the agent loop', minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxIterations?: number;

  @ApiPropertyOptional({ description: 'Whether the agent is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
