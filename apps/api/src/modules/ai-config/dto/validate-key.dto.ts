import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateKeyDto {
  @ApiProperty({
    description: 'Anthropic API key to validate',
    example: 'sk-ant-api03-...',
  })
  @IsString()
  apiKey: string;

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
