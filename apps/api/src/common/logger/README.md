# Structured Logging with Pino

## Overview

This module provides structured JSON logging using Pino for the Support Helper API and Worker services. It includes automatic correlation ID tracking, sensitive data sanitization, and environment-aware formatting.

## Features

- **Structured JSON logging** in production
- **Pretty-printed colored logs** in development
- **Automatic correlation ID** injection for request tracing
- **Sensitive field redaction** (passwords, tokens, API keys, etc.)
- **Configurable log levels** via `LOG_LEVEL` environment variable
- **Request/response logging** with timing
- **Database query logging**
- **External service call logging**
- **Security event logging**

## Usage

### Basic Logging

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLoggerService } from '../common/logger/pino-logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: PinoLoggerService) {
    this.logger.setContext('MyService');
  }

  doSomething() {
    this.logger.log('Operation started', { userId: '123', operation: 'create' });
    this.logger.warn('Warning message', { detail: 'something' });
    this.logger.error('Error occurred', new Error('Something went wrong'));
  }
}
```

### Structured Logging Helpers

```typescript
// Log HTTP request
this.logger.logRequest('GET', '/api/tickets', 200, 150);

// Log database query
this.logger.logDatabaseQuery('SELECT * FROM tickets WHERE tenantId = ?', 25);

// Log external service call
this.logger.logExternalService('OpenAI', 'completion', 1500, true);

// Log security event
this.logger.logSecurityEvent('failed_login', userId);
```

## Configuration

### Environment Variables

```bash
# Log level (default: info)
LOG_LEVEL=debug|info|warn|error

# Node environment (affects formatting)
NODE_ENV=development|production
```

### Log Levels

- `error` - Errors and exceptions
- `warn` - Warnings and degraded states
- `info` - General information (default)
- `debug` - Detailed debugging information

## Sensitive Data Redaction

The following fields are automatically redacted from logs:

- `password`
- `api_key`, `apiKey`
- `token`, `accessToken`, `refreshToken`
- `secret`, `privateKey`
- `authorization`, `x-sdk-key`
- `credit_card`, `ssn`
- `cookie`, `cookies`

Redacted values are replaced with `[REDACTED]`.

## Correlation ID

Every HTTP request is automatically assigned a correlation ID (via `X-Request-Id` header). This ID is:

1. Extracted from incoming request headers if present
2. Generated as a new UUID if missing
3. Added to all log entries for that request
4. Returned in the response header

This allows tracing a request across multiple services and log entries.

## Output Format

### Development

```
12:34:56 INFO  [MyService][a1b2c3d4] Operation started {"userId":"123","operation":"create"}
```

### Production

```json
{
  "level": "info",
  "time": "2024-02-16T12:34:56.789Z",
  "service": "support-helper-api",
  "environment": "production",
  "version": "0.1.0",
  "pid": 12345,
  "hostname": "api-server-1",
  "context": "MyService",
  "correlationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "msg": "Operation started",
  "userId": "123",
  "operation": "create"
}
```

## Integration

The logger is registered as a global module and automatically used by NestJS for all internal logging. The structured logging interceptor automatically logs all HTTP requests.

## Worker Logging

The worker service uses the same Pino logger with automatic job correlation. Job IDs are included in log entries for tracing.

```typescript
this.logger.logJob('video-analysis', jobId, 'started', { fileName: 'video.mp4' });
```
