import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating the issue template on a project GitHub config.
 */
export class UpdateIssueTemplateDto {
  @ApiProperty({ description: 'The issue body template with {{placeholders}}' })
  @IsString()
  @IsNotEmpty()
  template: string;
}

/**
 * DTO for previewing a rendered template.
 */
export class PreviewIssueTemplateDto {
  @ApiPropertyOptional({
    description:
      'Optional custom template to preview. If omitted, uses the saved or default template.',
  })
  @IsOptional()
  @IsString()
  template?: string;
}

/**
 * Response for GET /template
 */
export class IssueTemplateResponseDto {
  @ApiProperty({ description: 'The current template string' })
  template: string;

  @ApiProperty({ description: 'Whether this is the default template' })
  isDefault: boolean;

  @ApiProperty({ description: 'Available placeholders with descriptions' })
  placeholders: Record<string, string>;
}

/**
 * Response for POST /template/preview
 */
export class TemplatePreviewResponseDto {
  @ApiProperty({ description: 'The rendered template with sample data' })
  rendered: string;

  @ApiProperty({ description: 'The raw template used' })
  template: string;

  @ApiProperty({ description: 'Sample data used for rendering' })
  sampleData: Record<string, string>;
}
