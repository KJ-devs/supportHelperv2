/**
 * Environment Variable Validation (Pre-Bootstrap)
 *
 * This validation runs BEFORE NestJS application bootstrap to ensure
 * all required environment variables are present with helpful error messages.
 *
 * Validates:
 * - Required variables (app won't start without them)
 * - Type checking (e.g., PORT must be a number)
 * - Provides setup instructions for missing variables
 */

import { InternalServerErrorException } from '@nestjs/common';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env files before validation (same order as ConfigModule)
const root = resolve(__dirname, '..', '..', '..', '..');
config({ path: resolve(root, '.env.local'), override: false });
config({ path: resolve(root, '.env'), override: false });
config({ path: resolve(__dirname, '..', '..', '.env.local'), override: false });
config({ path: resolve(__dirname, '..', '..', '.env'), override: false });

interface ValidationError {
  variable: string;
  message: string;
  setupHint?: string;
}

/**
 * Required environment variables with setup instructions
 */
const REQUIRED_VARIABLES: Array<{
  name: string;
  aliases?: string[];
  validator?: (value: string) => boolean;
  setupHint?: string;
}> = [
  {
    name: 'DATABASE_URL',
    setupHint: 'PostgreSQL connection string (e.g., postgresql://user:pass@localhost:5432/db)',
  },
  {
    name: 'REDIS_URL',
    setupHint: 'Redis connection string (e.g., redis://localhost:6379)',
  },
  {
    name: 'JWT_SECRET',
    setupHint: 'Generate with: openssl rand -hex 32',
    validator: (value: string) => {
      const insecureDefaults = [
        'your-super-secret-jwt-key-change-in-production',
        'change-me',
        'secret',
      ];
      return !insecureDefaults.includes(value) && value.length >= 32;
    },
  },
  {
    name: 'JWT_REFRESH_SECRET',
    setupHint: 'Generate with: openssl rand -hex 32',
    validator: (value: string) => {
      const insecureDefaults = [
        'your-super-secret-jwt-key-change-in-production',
        'change-me',
        'secret',
      ];
      return !insecureDefaults.includes(value) && value.length >= 32;
    },
  },
  // Note: ANTHROPIC_API_KEY and OPENAI_API_KEY are optional — at least one should be configured
  // They are listed under OPTIONAL_VARIABLES below
  {
    name: 'S3_ENDPOINT',
    setupHint: 'S3/MinIO endpoint (e.g., http://localhost:9000)',
  },
  {
    name: 'S3_ACCESS_KEY_ID',
    aliases: ['S3_ACCESS_KEY'],
    setupHint: 'S3/MinIO access key ID (e.g., minioadmin for local MinIO)',
  },
  {
    name: 'S3_SECRET_ACCESS_KEY',
    aliases: ['S3_SECRET_KEY'],
    setupHint: 'S3/MinIO secret access key (e.g., minioadmin for local MinIO)',
  },
  {
    name: 'S3_BUCKET',
    setupHint: 'S3/MinIO bucket name (e.g., videos)',
  },
  {
    name: 'INTEGRATION_ENCRYPTION_KEY',
    setupHint: 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    validator: (value: string) => {
      // Must be 64 hex characters (32 bytes)
      return /^[a-f0-9]{64}$/i.test(value);
    },
  },
  {
    name: 'ENCRYPTION_KEY',
    setupHint: 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    validator: (value: string) => {
      // Must be 64 hex characters (32 bytes)
      return /^[a-f0-9]{64}$/i.test(value);
    },
  },
  {
    name: 'INTERNAL_API_SECRET',
    setupHint: 'Generate with: openssl rand -hex 32 (min 32 characters)',
    validator: (value: string) => {
      return value.length >= 32;
    },
  },
];

/**
 * Optional environment variables (documented but not required)
 */
const OPTIONAL_VARIABLES = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'SENTRY_DSN',
  'POSTHOG_API_KEY',
  'BETTERSTACK_SOURCE_TOKEN',
  'MEILISEARCH_HOST',
  'MEILISEARCH_MASTER_KEY',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  // Stripe (optional — billing features disabled if not set)
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_ENTERPRISE',
];

/**
 * Validate environment variables before application bootstrap
 * @throws Error if validation fails
 */
export function validateEnvironmentVariables(): void {
  const errors: ValidationError[] = [];

  // Validate required variables
  for (const { name, aliases, validator, setupHint } of REQUIRED_VARIABLES) {
    let value = process.env[name];

    // Check aliases if primary name is not set
    if ((!value || value.trim() === '') && aliases) {
      for (const alias of aliases) {
        if (process.env[alias] && process.env[alias].trim() !== '') {
          value = process.env[alias];
          process.env[name] = value; // Promote alias to expected name
          break;
        }
      }
    }

    if (!value || value.trim() === '') {
      errors.push({
        variable: name,
        message: 'Missing required variable',
        setupHint,
      });
      continue;
    }

    // Run custom validator if provided
    if (validator && !validator(value)) {
      errors.push({
        variable: name,
        message: 'Invalid value',
        setupHint,
      });
    }
  }

  // Validate PORT if provided (must be a number)
  const apiPort = process.env.API_PORT;
  if (apiPort && isNaN(Number(apiPort))) {
    errors.push({
      variable: 'API_PORT',
      message: 'Must be a valid number',
      setupHint: 'e.g., 3001',
    });
  }

  // If there are errors, format and throw
  if (errors.length > 0) {
    const errorMessage = formatValidationErrors(errors);
    throw new InternalServerErrorException(errorMessage);
  }

  // Log optional variables status (for informational purposes)
  logOptionalVariablesStatus();
}

/**
 * Format validation errors into a readable message
 */
function formatValidationErrors(errors: ValidationError[]): string {
  const lines: string[] = [
    '',
    '╔════════════════════════════════════════════════════════════════════════╗',
    '║  ❌ Environment Variable Validation Failed                             ║',
    '╚════════════════════════════════════════════════════════════════════════╝',
    '',
    'Missing or invalid required environment variables:',
    '',
  ];

  for (const error of errors) {
    lines.push(`  • ${error.variable}`);
    if (error.setupHint) {
      lines.push(`    ${error.setupHint}`);
    }
    lines.push('');
  }

  lines.push('');
  lines.push('Please check your .env.local file and ensure all required variables are set.');
  lines.push('See .env.example for reference.');
  lines.push('');
  lines.push('Application startup aborted.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Log status of optional variables (for debugging)
 */
function logOptionalVariablesStatus(): void {
  if (process.env.NODE_ENV === 'development') {
    const configured: string[] = [];
    const notConfigured: string[] = [];

    for (const variable of OPTIONAL_VARIABLES) {
      if (process.env[variable]) {
        configured.push(variable);
      } else {
        notConfigured.push(variable);
      }
    }

    if (notConfigured.length > 0) {
      console.log('\n📝 Optional variables not configured:');
      notConfigured.forEach((v) => console.log(`  • ${v}`));
    }

    if (configured.length > 0) {
      console.log('\n✅ Optional variables configured:');
      configured.forEach((v) => console.log(`  • ${v}`));
    }
  }
}
