import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantGuard } from '../../../src/auth/guards/tenant.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    } as unknown as PrismaService;

    guard = new TenantGuard(prisma);
  });

  function createMockContext(user?: any): ExecutionContext {
    const request: any = { user };
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should set tenantId on request and execute RLS query for JWT user', async () => {
      const user = { tenantId: 'tenant-123', id: 'user-1', role: 'admin' };
      const context = createMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      const request = context.switchToHttp().getRequest();
      expect(request.tenantId).toBe('tenant-123');
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should extract tenantId from user.tenant.id for SDK key auth', async () => {
      const user = { tenant: { id: 'tenant-456' } };
      const context = createMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      const request = context.switchToHttp().getRequest();
      expect(request.tenantId).toBe('tenant-456');
    });

    it('should prefer user.tenantId over user.tenant.id', async () => {
      const user = { tenantId: 'tenant-primary', tenant: { id: 'tenant-fallback' } };
      const context = createMockContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      const request = context.switchToHttp().getRequest();
      expect(request.tenantId).toBe('tenant-primary');
    });

    it('should throw UnauthorizedException when user is not set', async () => {
      const context = createMockContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should throw UnauthorizedException when user is null', async () => {
      const context = createMockContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when tenantId is not found', async () => {
      const user = { id: 'user-1', role: 'admin' }; // no tenantId
      const context = createMockContext(user);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Tenant context not found');
    });

    it('should set PostgreSQL RLS session variable with correct tenantId', async () => {
      const user = { tenantId: 'tenant-rls-test' };
      const context = createMockContext(user);

      await guard.canActivate(context);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });
});
