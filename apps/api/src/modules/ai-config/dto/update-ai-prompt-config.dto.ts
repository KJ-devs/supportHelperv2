import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class UpdateAiPromptConfigDto {
  @ApiPropertyOptional({
    description: 'Description of your product/service — injected into all AI prompts for context',
    example:
      'We are a SaaS billing platform for B2B companies. Core features: invoicing, subscriptions, payment processing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  productDescription?: string;

  @ApiPropertyOptional({
    description: 'Global custom instructions applied to all AI features',
    example:
      'Focus on security vulnerabilities. Our critical components are: auth, billing, webhooks.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  globalInstructions?: string;

  @ApiPropertyOptional({
    description: 'Custom instructions for ticket triage/classification',
    example:
      'Classify payment-related issues as critical severity. Feature requests about reporting should be marked as high priority.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  triageInstructions?: string;

  @ApiPropertyOptional({
    description:
      'Custom instructions for N1 pre-triage assessment (resolve/duplicate/escalate decision)',
    example: '404 errors on /api/legacy/* are expected behavior, do not escalate',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  n1Instructions?: string;

  @ApiPropertyOptional({
    description: 'Custom instructions for deep code analysis',
    example:
      'Always check the billing module first for payment issues. Our webhook handler is in src/webhooks/.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  analysisInstructions?: string;

  @ApiPropertyOptional({
    description: 'Preferred language for AI responses (ISO 639-1 code)',
    example: 'fr',
  })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'ja', 'ko', 'zh', 'ar', 'ru'])
  responseLanguage?: string;

  @ApiPropertyOptional({
    description: 'Enable/disable automatic triage classification (type, severity)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enableTriage?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable N1 smart pre-triage assessment',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enableN1?: boolean;

  @ApiPropertyOptional({
    description: 'Enable/disable N2 autonomous deep analysis',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enableN2?: boolean;

  @ApiPropertyOptional({
    description: 'Temperature for triage classification AI (0.0-1.0). Lower = more consistent.',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  triageTemperature?: number;

  @ApiPropertyOptional({
    description: 'Temperature for N1 triage AI (0.0-1.0). Lower = more predictable decisions.',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  n1Temperature?: number;

  @ApiPropertyOptional({
    description:
      'Temperature for deep analysis AI (0.0-1.0). Higher = more creative investigation.',
    example: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  analysisTemperature?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of agentic iterations for N2 deep analysis (5-30).',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  maxIterationsN2?: number;

  @ApiPropertyOptional({
    description: 'Maximum duration in seconds for N2 deep analysis (30-300).',
    example: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(300)
  timeoutN2?: number;
}
