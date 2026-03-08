---
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.{ts,tsx}'
---

# Regles de code style

- Pas de `any` en TypeScript — utilise des types stricts
- Pas de `console.log` en production — utilise le LoggerService (NestJS) ou un logger
- Pas de code commente — supprime-le ou cree une issue
- Fonctions courtes et focalisees (< 50 lignes)
- Nommage explicite : pas d'abreviations cryptiques
- Imports organises : dependances externes d'abord, puis internes
- TypeScript strict mode enabled
- `async/await` over promises
- NestJS decorators: `@Injectable()`, `@Controller()`, `@Get()`, etc.
- DTOs: `class-validator` decorators (`@IsString()`, `@IsOptional()`)
- Prisma via `PrismaService` injected through constructor
- Error handling: NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.)
