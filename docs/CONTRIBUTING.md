# Contributing to Support Helper

Thank you for your interest in contributing to Support Helper! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept responsibility for mistakes and learn from them

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose
- Git

### Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/support-helper.git
cd support-helper
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment**

```bash
cp .env.example .env.local
```

4. **Start infrastructure**

```bash
pnpm docker:up
```

5. **Set up database**

```bash
pnpm db:migrate
pnpm db:seed
```

6. **Start development servers**

```bash
pnpm dev
```

### Project Structure

```
support-helper/
├── apps/
│   ├── api/           # NestJS backend
│   ├── dashboard/     # Next.js dashboard
│   ├── web/           # Marketing website
│   └── worker/        # Background jobs
├── packages/
│   ├── sdk-web/       # Web SDK
│   ├── shared/        # Shared types
│   └── database/      # DB utilities
├── docs/              # Documentation
└── docker/            # Docker configs
```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

Examples:
```
feature/video-compression
fix/auth-token-expiry
docs/api-reference
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run tests for specific package
pnpm --filter @support-helper/api test
```

### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Fix linting issues
pnpm lint --fix

# Format code
pnpm format
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for functions
- Avoid `any` - use `unknown` or proper types

```typescript
// Good
interface UserConfig {
  id: string;
  email: string;
  name?: string;
}

function getUser(id: string): Promise<UserConfig | null> {
  // ...
}

// Avoid
type UserConfig = {
  id: any;
  email: any;
};
```

### NestJS (Backend)

- Use decorators appropriately
- Inject dependencies via constructor
- Use DTOs with class-validator
- Handle errors with NestJS exceptions

```typescript
// Controller
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string): Promise<Ticket> {
    const ticket = await this.ticketsService.findOne(id);
    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }
    return ticket;
  }
}
```

### React/Next.js (Frontend)

- Use functional components with hooks
- Prefer TanStack Query for server state
- Use Zustand for client state
- Add `'use client'` directive when needed

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

export function TicketList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;

  return (
    <ul>
      {data?.map(ticket => (
        <TicketItem key={ticket.id} ticket={ticket} />
      ))}
    </ul>
  );
}
```

### File Naming

- Use kebab-case for files: `video-recorder.ts`
- Use PascalCase for React components: `TicketList.tsx`
- Use `.spec.ts` suffix for tests: `tickets.service.spec.ts`
- Use `.dto.ts` suffix for DTOs: `create-ticket.dto.ts`

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```
feat(sdk): add video compression option

fix(api): handle null user context in ticket creation

docs(readme): update installation instructions

refactor(dashboard): extract ticket list into component

test(api): add unit tests for media service
```

### Rules

1. Use present tense ("add feature" not "added feature")
2. Use imperative mood ("move cursor" not "moves cursor")
3. Keep first line under 72 characters
4. Reference issues in footer when applicable

## Pull Request Process

### Before Submitting

1. **Ensure tests pass**
   ```bash
   pnpm test
   pnpm lint
   ```

2. **Update documentation** if needed

3. **Add/update tests** for your changes

4. **Rebase on main** to avoid merge conflicts
   ```bash
   git fetch origin
   git rebase origin/main
   ```

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe testing approach

## Checklist
- [ ] My code follows the project style
- [ ] I have added tests
- [ ] I have updated documentation
- [ ] All tests pass locally
```

### Review Process

1. At least one maintainer approval required
2. All CI checks must pass
3. No merge conflicts
4. Squash commits before merging (optional)

## Issue Guidelines

### Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Screenshots/videos if applicable

### Feature Requests

Include:
- Problem description
- Proposed solution
- Alternative solutions considered
- Additional context

### Labels

- `bug` - Something isn't working
- `feature` - New feature request
- `docs` - Documentation improvement
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `priority: high` - High priority
- `wontfix` - Won't be addressed

## Adding New Features

### Backend Module

```bash
cd apps/api
nest generate module feature-name
nest generate service feature-name
nest generate controller feature-name
```

### Database Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm db:migrate`
3. Run `pnpm db:generate`
4. Update seed file if needed

### Frontend Pages

1. Create in `apps/dashboard/app/[route]/page.tsx`
2. Use `'use client'` for interactive components
3. Add to navigation if needed

## Questions?

- Check existing [issues](https://github.com/your-org/support-helper/issues)
- Open a [discussion](https://github.com/your-org/support-helper/discussions)
- Read the [documentation](../README.md)

Thank you for contributing!
