import { IsString, IsEmail, MinLength, IsOptional, IsNumber, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  organizationName: string;
}

export class ValidateAiKeyDto {
  @ApiProperty({ example: 'sk-...' })
  @IsString()
  apiKey: string;
}

export class SmtpConfigDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  host: string;

  @ApiProperty({ example: 587 })
  @IsNumber()
  port: number;

  @ApiProperty({ example: 'user@gmail.com', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ example: 'password', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'noreply@example.com' })
  @IsEmail()
  fromEmail: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  secure?: boolean;
}

export class SaveProgressDto {
  @ApiProperty({ example: 2 })
  @IsNumber()
  currentStep: number;

  @ApiProperty({ example: ['admin', 'ai-key'] })
  @IsArray()
  @IsString({ each: true })
  completedSteps: string[];
}
