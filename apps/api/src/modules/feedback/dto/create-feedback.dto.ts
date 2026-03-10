import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsIn,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const FEEDBACK_FIELDS = ['type', 'severity'] as const;
export type FeedbackField = (typeof FEEDBACK_FIELDS)[number];

export const VALID_TYPE_VALUES = [
  'bug',
  'feature_request',
  'question',
  'documentation',
  'performance',
  'security',
] as const;

export const VALID_SEVERITY_VALUES = ['critical', 'high', 'medium', 'low'] as const;

const FIELD_VALUES: Record<FeedbackField, readonly string[]> = {
  type: VALID_TYPE_VALUES,
  severity: VALID_SEVERITY_VALUES,
};

function IsCorrectedValueValidForField(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCorrectedValueValidForField',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const dto = args.object as CreateFeedbackDto;
          if (!dto.field || !value) return false;

          const allowedValues = FIELD_VALUES[dto.field as FeedbackField];
          if (!allowedValues) return false;

          return (allowedValues as readonly unknown[]).includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as CreateFeedbackDto;
          const allowedValues = FIELD_VALUES[dto.field as FeedbackField];
          if (!allowedValues) {
            return `field must be one of: ${FEEDBACK_FIELDS.join(', ')}`;
          }
          return `correctedValue must be one of [${allowedValues.join(', ')}] when field is "${dto.field}"`;
        },
      },
    });
  };
}

export class CreateFeedbackDto {
  @ApiProperty({ description: 'Ticket ID this feedback is for', format: 'uuid' })
  @IsUUID()
  ticketId: string;

  @ApiProperty({
    description: 'Classification field being corrected',
    enum: FEEDBACK_FIELDS,
    example: 'type',
  })
  @IsIn(FEEDBACK_FIELDS, {
    message: `field must be one of: ${FEEDBACK_FIELDS.join(', ')}`,
  })
  field: FeedbackField;

  @ApiPropertyOptional({
    description: 'Original AI-assigned value',
    example: 'bug',
  })
  @IsOptional()
  @IsString()
  originalValue?: string;

  @ApiProperty({
    description: 'Human-corrected value. Must be valid for the given field.',
    example: 'feature_request',
  })
  @IsNotEmpty()
  @IsString()
  @IsCorrectedValueValidForField()
  correctedValue: string;
}
