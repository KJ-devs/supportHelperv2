import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

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
}
