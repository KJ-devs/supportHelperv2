---
applyTo: 'apps/api/**/*.ts,apps/worker/**/*.ts'
---

# Backend Development Instructions

- Use NestJS decorators: `@Injectable()`, `@Controller()`, `@Get()`, `@Post()`
- ALL Prisma queries MUST filter by `tenantId` for multi-tenant isolation
- Use `JwtAuthGuard` for dashboard endpoints, `SdkKeyGuard` for SDK endpoints
- DTOs use `class-validator`: `@IsString()`, `@IsOptional()`, `@IsUUID()`
- Inject `PrismaService` via constructor injection
- Error handling: throw `BadRequestException`, `NotFoundException`, `ForbiddenException`
- Document endpoints with Swagger decorators: `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`
- Use `async/await` over raw promises
- New modules: `nest generate module|service|controller feature-name`
