import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AIProviderType } from './update-ai-config.dto';

export class ValidateKeyDto {
  @ApiPropertyOptional({
    description: 'API key to validate (not required for Ollama or Bedrock)',
    example: 'sk-ant-api03-...',
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description: 'AI provider type',
    enum: AIProviderType,
    example: AIProviderType.ANTHROPIC,
  })
  @IsOptional()
  @IsEnum(AIProviderType)
  provider?: AIProviderType;

  @ApiPropertyOptional({
    description: 'Endpoint URL (for Ollama)',
    example: 'http://localhost:11434',
  })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'Model to test',
    example: 'claude-sonnet-4-6',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
