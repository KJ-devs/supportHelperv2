import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyStrategy } from '../../../src/modules/auth/strategies/api-key.strategy';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { ApplicationEntity } from '../../../src/modules/auth/dto/auth.dto';

describe('ApiKeyStrategy', () => {
  let strategy: ApiKeyStrategy;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = {
      validateApiKey: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyStrategy,
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    strategy = module.get<ApiKeyStrategy>(ApiKeyStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    const mockApplication: ApplicationEntity = {
      id: 'app-1',
      tenantId: 'tenant-1',
      name: 'Test App',
      platform: 'web',
      sdkKey: 'test-api-key',
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test-tenant',
        plan: 'free',
      },
    };

    it('should validate API key from x-api-key header and return application', async () => {
      const req = {
        headers: {
          'x-api-key': 'test-api-key',
        },
      } as any as Request;

      authService.validateApiKey.mockResolvedValue(mockApplication as any);

      const result = await strategy.validate(req);

      expect(authService.validateApiKey).toHaveBeenCalledWith('test-api-key');
      expect(result).toEqual(mockApplication);
    });

    it('should validate API key from x-sdk-key header (backwards compatibility)', async () => {
      const req = {
        headers: {
          'x-sdk-key': 'test-sdk-key',
        },
      } as any as Request;

      authService.validateApiKey.mockResolvedValue(mockApplication as any);

      const result = await strategy.validate(req);

      expect(authService.validateApiKey).toHaveBeenCalledWith('test-sdk-key');
      expect(result).toEqual(mockApplication);
    });

    it('should prioritize x-api-key over x-sdk-key when both present', async () => {
      const req = {
        headers: {
          'x-api-key': 'api-key-value',
          'x-sdk-key': 'sdk-key-value',
        },
      } as any as Request;

      authService.validateApiKey.mockResolvedValue(mockApplication as any);

      await strategy.validate(req);

      expect(authService.validateApiKey).toHaveBeenCalledWith('api-key-value');
    });

    it('should throw UnauthorizedException when no API key provided', async () => {
      const req = {
        headers: {},
      } as any as Request;

      await expect(strategy.validate(req)).rejects.toThrow(
        new UnauthorizedException('API key is required')
      );

      expect(authService.validateApiKey).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when API key is invalid', async () => {
      const req = {
        headers: {
          'x-api-key': 'invalid-key',
        },
      } as any as Request;

      authService.validateApiKey.mockResolvedValue(null as any);

      await expect(strategy.validate(req)).rejects.toThrow(
        new UnauthorizedException('Invalid API key')
      );

      expect(authService.validateApiKey).toHaveBeenCalledWith('invalid-key');
    });

    it('should handle empty string API key', async () => {
      const req = {
        headers: {
          'x-api-key': '',
        },
      } as any as Request;

      await expect(strategy.validate(req)).rejects.toThrow(
        new UnauthorizedException('API key is required')
      );
    });

    it('should handle application without tenant', async () => {
      const appWithoutTenant: ApplicationEntity = {
        id: 'app-1',
        tenantId: 'tenant-1',
        name: 'Test App',
        platform: 'web',
        sdkKey: 'test-api-key',
      };

      const req = {
        headers: {
          'x-api-key': 'test-api-key',
        },
      } as any as Request;

      authService.validateApiKey.mockResolvedValue(appWithoutTenant as any);

      const result = await strategy.validate(req);

      expect(result).toEqual(appWithoutTenant);
    });
  });
});
