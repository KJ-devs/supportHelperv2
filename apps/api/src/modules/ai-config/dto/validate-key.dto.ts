import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateKeyDto {
  @ApiProperty({
    description: 'Anthropic API key to validate',
    example: 'sk-ant-api03-...',
  })
  @IsString()
  apiKey: string;
}
