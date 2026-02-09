import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SdkKeyGuard } from '../../../src/common/guards/sdk-key.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('SdkKeyGuard (common)', () => {
  let guard: SdkKeyGuard;
  let prisma: any;

  const mockApplication = {
    id: 'app-123',
    tenantId: 'tenant-123',
    name: 'Test App',
    sdkKey: 'valid-sdk-key-123',
    platform: 'web',
    tenant: {
      id: 'tenant-123',
      name: 'Test Tenant',
      plan: 'free',
    },
  };

  beforeEach(() => {
    prisma = {
      application: {
        findUnique: jest.fn(),
      },
    };

    guard = new SdkKeyGuard(prisma as unknown as PrismaService);
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const request: any = { headers };
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
    it('should return true and set sdk/user on request for valid SDK key', async () => {
      const context = createMockContext({ 'x-sdk-key': 'valid-sdk-key-123' });
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      const request = context.switchToHttp().getRequest();
      expect(request.sdk).toEqual({
        applicationId: 'app-123',
        tenantId: 'tenant-123',
        sdkKey: 'valid-sdk-key-123',
      });
      expect(request.user).toEqual({
        userId: 'app-123',
        tenantId: 'tenant-123',
        email: 'sdk@Test Tenant',
        role: 'sdk',
      });
    });

    it('should throw UnauthorizedException when x-sdk-key header is missing', async () => {
      const context = createMockContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('SDK key is required');
    });

    it('should throw UnauthorizedException when x-sdk-key is empty string', async () => {
      const context = createMockContext({ 'x-sdk-key': '' });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when SDK key is not found in database', async () => {
      const context = createMockContext({ 'x-sdk-key': 'invalid-key' });
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid SDK key');
    });

    it('should query database with correct SDK key and include tenant', async () => {
      const context = createMockContext({ 'x-sdk-key': 'test-key-abc' });
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      await guard.canActivate(context);

      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { sdkKey: 'test-key-abc' },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              plan: true,
            },
          },
        },
      });
    });

    it('should set user.email based on tenant name', async () => {
      const appWithCustomTenant = {
        ...mockApplication,
        tenant: { ...mockApplication.tenant, name: 'Acme Corp' },
      };
      const context = createMockContext({ 'x-sdk-key': 'valid-sdk-key-123' });
      prisma.application.findUnique.mockResolvedValue(appWithCustomTenant);

      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest();
      expect(request.user.email).toBe('sdk@Acme Corp');
    });
  });
});
