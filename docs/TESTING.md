# Testing Guide

Comprehensive guide to testing Support Helper.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [E2E Testing](#e2e-testing)
- [Test Utilities](#test-utilities)
- [Mocking](#mocking)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Overview

### Testing Stack

| Tool | Purpose |
|------|---------|
| **Jest** | Test runner and assertions |
| **Supertest** | HTTP endpoint testing |
| **@nestjs/testing** | NestJS module testing |
| **Vitest** | SDK testing |
| **Testcontainers** | Integration test databases |
| **MSW** | API mocking |

### Test Types

- **Unit Tests**: Isolated component testing
- **Integration Tests**: Database and external service testing
- **E2E Tests**: Full API flow testing

## Test Structure

```
apps/api/
├── src/
│   └── modules/
│       └── tickets/
│           ├── tickets.service.ts
│           ├── tickets.service.spec.ts      # Unit tests
│           ├── tickets.controller.ts
│           └── tickets.controller.spec.ts   # Unit tests
└── test/
    ├── unit/                                 # Unit test helpers
    ├── integration/                          # Integration tests
    │   └── tickets.integration.spec.ts
    ├── e2e/                                  # E2E tests
    │   └── tickets.e2e-spec.ts
    ├── fixtures/                             # Test data
    │   └── tickets.fixture.ts
    ├── helpers/                              # Test utilities
    │   └── test-app.ts
    └── jest-e2e.config.ts                   # E2E Jest config
```

## Running Tests

### All Tests

```bash
# Run all tests across packages
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Package-Specific

```bash
# API tests
pnpm --filter @support-helper/api test
pnpm --filter @support-helper/api test:unit
pnpm --filter @support-helper/api test:integration
pnpm --filter @support-helper/api test:e2e

# SDK tests
pnpm --filter @support-helper/sdk-web test
pnpm --filter @support-helper/sdk-web test:coverage
```

### Specific Tests

```bash
# Run specific test file
pnpm --filter @support-helper/api test tickets.service.spec.ts

# Run tests matching pattern
pnpm --filter @support-helper/api test --testNamePattern="should create ticket"

# Run in debug mode
pnpm --filter @support-helper/api test --detectOpenHandles --forceExit
```

## Unit Testing

### Testing Services

```typescript
// tickets.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: PrismaService;

  // Mock PrismaService
  const mockPrismaService = {
    ticket: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated tickets', async () => {
      const mockTickets = [
        { id: '1', title: 'Ticket 1' },
        { id: '2', title: 'Ticket 2' },
      ];

      mockPrismaService.ticket.findMany.mockResolvedValue(mockTickets);

      const result = await service.findAll({
        tenantId: 'tenant-1',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockTickets);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by status', async () => {
      await service.findAll({
        tenantId: 'tenant-1',
        status: 'open',
      });

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            status: 'open',
          },
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a new ticket', async () => {
      const createDto = {
        title: 'New Bug',
        description: 'Bug description',
        applicationId: 'app-1',
      };

      const mockCreated = {
        id: 'ticket-1',
        ...createDto,
        status: 'new',
        createdAt: new Date(),
      };

      mockPrismaService.ticket.create.mockResolvedValue(mockCreated);

      const result = await service.create('tenant-1', createDto);

      expect(result).toEqual(mockCreated);
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          title: 'New Bug',
        }),
      });
    });
  });

  describe('findOne', () => {
    it('should return ticket by id', async () => {
      const mockTicket = { id: 'ticket-1', title: 'Test' };
      mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);

      const result = await service.findOne('tenant-1', 'ticket-1');

      expect(result).toEqual(mockTicket);
    });

    it('should return null for non-existent ticket', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(null);

      const result = await service.findOne('tenant-1', 'non-existent');

      expect(result).toBeNull();
    });
  });
});
```

### Testing Controllers

```typescript
// tickets.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { NotFoundException } from '@nestjs/common';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: TicketsService;

  const mockTicketsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockUser = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    email: 'test@example.com',
    role: 'admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    service = module.get<TicketsService>(TicketsService);
  });

  describe('findAll', () => {
    it('should return tickets array', async () => {
      const expected = {
        data: [{ id: '1' }],
        meta: { total: 1 },
      };
      mockTicketsService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser, {});

      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should return ticket', async () => {
      const ticket = { id: '1', title: 'Test' };
      mockTicketsService.findOne.mockResolvedValue(ticket);

      const result = await controller.findOne(mockUser, '1');

      expect(result).toEqual(ticket);
    });

    it('should throw NotFoundException', async () => {
      mockTicketsService.findOne.mockResolvedValue(null);

      await expect(controller.findOne(mockUser, '1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

## Integration Testing

### Setup with Testcontainers

```typescript
// test/integration/setup.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';

let postgresContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

export async function setupTestContainers() {
  // Start PostgreSQL
  postgresContainer = await new PostgreSqlContainer()
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  // Set DATABASE_URL
  process.env.DATABASE_URL = postgresContainer.getConnectionUri();

  // Start Redis
  redisContainer = await new RedisContainer().start();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();

  // Run migrations
  execSync('npx prisma migrate deploy', {
    env: { ...process.env },
    stdio: 'inherit',
  });
}

export async function teardownTestContainers() {
  await postgresContainer?.stop();
  await redisContainer?.stop();
}
```

### Integration Test Example

```typescript
// test/integration/tickets.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { setupTestContainers, teardownTestContainers } from './setup';

describe('Tickets Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    await setupTestContainers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await teardownTestContainers();
  });

  beforeEach(async () => {
    // Clean database between tests
    await prisma.ticket.deleteMany();
    await prisma.application.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();
  });

  it('should create and retrieve ticket', async () => {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant', slug: 'test' },
    });

    // Create application
    const app = await prisma.application.create({
      data: {
        tenantId: tenant.id,
        name: 'Test App',
        sdkKey: 'sk_test_123',
      },
    });

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        applicationId: app.id,
        title: 'Test Bug',
        description: 'Description',
      },
    });

    // Verify
    const found = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });

    expect(found).toBeDefined();
    expect(found?.title).toBe('Test Bug');
  });
});
```

## E2E Testing

### Test App Setup

```typescript
// test/helpers/test-app.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as request from 'supertest';

export class TestApp {
  app: INestApplication;
  prisma: PrismaService;
  authToken: string;
  testTenant: any;
  testUser: any;

  async init() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await this.app.init();

    this.prisma = this.app.get(PrismaService);
  }

  async setupTestData() {
    // Create tenant
    this.testTenant = await this.prisma.tenant.create({
      data: { name: 'E2E Test', slug: 'e2e-test' },
    });

    // Create user
    this.testUser = await this.prisma.user.create({
      data: {
        tenantId: this.testTenant.id,
        email: 'e2e@test.com',
        name: 'E2E User',
        role: 'admin',
        passwordHash: await bcrypt.hash('password123', 10),
      },
    });

    // Get auth token
    const response = await request(this.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'e2e@test.com', password: 'password123' });

    this.authToken = response.body.accessToken;
  }

  async cleanup() {
    await this.prisma.ticket.deleteMany();
    await this.prisma.application.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.tenant.deleteMany();
  }

  async close() {
    await this.app.close();
  }

  request() {
    return request(this.app.getHttpServer());
  }

  authRequest() {
    return request(this.app.getHttpServer())
      .set('Authorization', `Bearer ${this.authToken}`);
  }
}
```

### E2E Test Example

```typescript
// test/e2e/tickets.e2e-spec.ts
import { TestApp } from '../helpers/test-app';

describe('Tickets E2E', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = new TestApp();
    await testApp.init();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.cleanup();
    await testApp.setupTestData();
  });

  describe('GET /api/tickets', () => {
    it('should require authentication', async () => {
      const response = await testApp.request()
        .get('/api/tickets');

      expect(response.status).toBe(401);
    });

    it('should return empty list initially', async () => {
      const response = await testApp.request()
        .get('/api/tickets')
        .set('Authorization', `Bearer ${testApp.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return tickets for tenant', async () => {
      // Create test application
      const app = await testApp.prisma.application.create({
        data: {
          tenantId: testApp.testTenant.id,
          name: 'Test App',
          sdkKey: 'sk_test_123',
        },
      });

      // Create tickets
      await testApp.prisma.ticket.create({
        data: {
          tenantId: testApp.testTenant.id,
          applicationId: app.id,
          title: 'Test Ticket',
        },
      });

      const response = await testApp.request()
        .get('/api/tickets')
        .set('Authorization', `Bearer ${testApp.authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Test Ticket');
    });
  });

  describe('POST /api/tickets', () => {
    it('should create ticket', async () => {
      const app = await testApp.prisma.application.create({
        data: {
          tenantId: testApp.testTenant.id,
          name: 'Test App',
          sdkKey: 'sk_test_123',
        },
      });

      const response = await testApp.request()
        .post('/api/tickets')
        .set('Authorization', `Bearer ${testApp.authToken}`)
        .send({
          title: 'New Bug',
          description: 'Bug description',
          applicationId: app.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe('New Bug');
    });

    it('should validate required fields', async () => {
      const response = await testApp.request()
        .post('/api/tickets')
        .set('Authorization', `Bearer ${testApp.authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tickets/:id', () => {
    it('should update ticket', async () => {
      // Create ticket first
      const app = await testApp.prisma.application.create({
        data: {
          tenantId: testApp.testTenant.id,
          name: 'Test App',
          sdkKey: 'sk_test_123',
        },
      });

      const ticket = await testApp.prisma.ticket.create({
        data: {
          tenantId: testApp.testTenant.id,
          applicationId: app.id,
          title: 'Original Title',
        },
      });

      const response = await testApp.request()
        .patch(`/api/tickets/${ticket.id}`)
        .set('Authorization', `Bearer ${testApp.authToken}`)
        .send({ status: 'in_progress' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('in_progress');
    });
  });
});
```

## Test Utilities

### Fixtures

```typescript
// test/fixtures/tickets.fixture.ts
import { faker } from '@faker-js/faker';

export function createTicketFixture(overrides = {}) {
  return {
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: 'new',
    type: faker.helpers.arrayElement(['bug', 'feature', 'question']),
    severity: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
    ...overrides,
  };
}

export function createUserFixture(overrides = {}) {
  return {
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'member',
    ...overrides,
  };
}

export function createTenantFixture(overrides = {}) {
  return {
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    plan: 'free',
    ...overrides,
  };
}
```

### Mock Helpers

```typescript
// test/helpers/mocks.ts
export const mockPrismaService = {
  ticket: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  tenant: {
    findUnique: jest.fn(),
  },
  application: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(cb => cb(mockPrismaService)),
};

export const mockS3Service = {
  getPresignedUploadUrl: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
  deleteObject: jest.fn(),
};

export const mockOpenAIService = {
  analyzeVideo: jest.fn(),
  classifyTicket: jest.fn(),
  generateEmbedding: jest.fn(),
};
```

## Mocking

### Mocking External Services

```typescript
// Mocking OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked response' } }],
        }),
      },
    },
  })),
}));

// Mocking S3
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
```

### MSW for API Mocking

```typescript
// test/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
    return res(
      ctx.json({
        choices: [{ message: { content: 'Mocked AI response' } }],
      }),
    );
  }),
];
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Run migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Run tests
        run: pnpm test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Best Practices

### General

1. **Test one thing per test** - Keep tests focused
2. **Use descriptive names** - `it('should return 404 when ticket not found')`
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Clean up after tests** - Prevent test pollution
5. **Don't test implementation details** - Test behavior

### Unit Tests

1. Mock external dependencies
2. Test edge cases
3. Test error handling
4. Keep tests fast (< 100ms each)

### Integration Tests

1. Use real database (Testcontainers)
2. Test database constraints
3. Test transactions
4. Clean database between tests

### E2E Tests

1. Test complete flows
2. Test authentication/authorization
3. Test validation
4. Use realistic data

### Coverage Goals

| Type | Target |
|------|--------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |
