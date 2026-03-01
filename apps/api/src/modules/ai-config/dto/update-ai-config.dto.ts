import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AIProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  GEMINI = 'gemini',
  BEDROCK = 'bedrock',
}

export class UpdateAiConfigDto {
  @ApiPropertyOptional({
    description: 'Anthropic API key (sk-ant-...)',
    example: 'sk-ant-api03-...',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'Model identifier',
    example: 'claude-sonnet-4-6',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Additional settings (e.g. max tokens, temperature)',
    example: { maxTokens: 4096, temperature: 0.7 },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
