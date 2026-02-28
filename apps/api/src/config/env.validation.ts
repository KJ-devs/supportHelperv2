import { plainToClass } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  validateSync,
  IsUrl,
} from 'class-validator';
import { InternalServerErrorException } from '@nestjs/common';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Environment variables validation class
 */
class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  API_PORT: number = 3001;

  // Database
  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  // S3/MinIO
  @IsString()
  S3_ENDPOINT: string;

  @IsString()
  S3_ACCESS_KEY_ID: string;

  @IsString()
  S3_SECRET_ACCESS_KEY: string;

  @IsString()
  S3_BUCKET: string;

  @IsString()
  @IsOptional()
  S3_REGION: string = 'us-east-1';

  // Anthropic (primary AI provider)
  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  // OpenAI (optional, for embeddings)
  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  // Meilisearch
  @IsUrl({ require_tld: false })
  @IsOptional()
  MEILISEARCH_HOST: string = 'http://localhost:7700';

  @IsString()
  @IsOptional()
  MEILISEARCH_MASTER_KEY?: string;

  // CORS
  @IsString()
  @IsOptional()
  DASHBOARD_URL: string = 'http://localhost:3000';

  // GitHub OAuth (optional)
  @IsString()
  @IsOptional()
  GITHUB_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GITHUB_WEBHOOK_SECRET?: string;

  // GitHub App (optional)
  @IsString()
  @IsOptional()
  GITHUB_APP_ID?: string;

  @IsString()
  @IsOptional()
  GITHUB_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  GITHUB_APP_NAME?: string;
}

/**
 * Validate environment variables
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new InternalServerErrorException(
      `Environment validation error:\n${errors.map((e) => Object.values(e.constraints || {}).join(', ')).join('\n')}`,
    );
  }

  return validatedConfig;
}
