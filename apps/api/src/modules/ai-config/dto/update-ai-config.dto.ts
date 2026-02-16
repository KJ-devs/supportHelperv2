import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AIProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
}

export class UpdateAiConfigDto {
  @ApiPropertyOptional({
    description: 'AI provider type',
    enum: AIProviderType,
    example: AIProviderType.ANTHROPIC,
  })
  @IsOptional()
  @IsEnum(AIProviderType)
  provider?: AIProviderType;

  @ApiPropertyOptional({
    description: 'API key for the provider (not required for Ollama)',
    example: 'sk-ant-api03-...',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'Model identifier',
    example: 'claude-sonnet-4-5-20250929',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Endpoint URL (for Ollama or custom endpoints)',
    example: 'http://localhost:11434',
  })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'Additional settings (e.g. max tokens, temperature)',
    example: { maxTokens: 4096, temperature: 0.7 },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
