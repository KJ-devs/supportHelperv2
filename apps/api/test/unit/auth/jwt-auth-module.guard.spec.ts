import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../src/modules/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard (modules/auth)', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: reflector,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (): ExecutionContext => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  });

  describe('canActivate', () => {
    it('should return true for public routes', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('should call super.canActivate for protected routes', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock super.canActivate to return true
      const superCanActivate = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate');
      superCanActivate.mockReturnValue(true);

      const result = guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(superCanActivate).toHaveBeenCalledWith(context);

      superCanActivate.mockRestore();
    });

    it('should check both handler and class for @Public decorator', () => {
      const context = createMockExecutionContext();
      const handler = context.getHandler();
      const classRef = context.getClass();

      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock super.canActivate
      jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(true);

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [handler, classRef]);
    });

    it('should return false when super.canActivate returns false', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      const superCanActivate = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate');
      superCanActivate.mockReturnValue(false);

      const result = guard.canActivate(context);

      expect(result).toBe(false);

      superCanActivate.mockRestore();
    });

    it('should handle undefined public metadata (defaults to false)', () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const superCanActivate = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate');
      superCanActivate.mockReturnValue(true);

      guard.canActivate(context);

      expect(superCanActivate).toHaveBeenCalled();

      superCanActivate.mockRestore();
    });

    it('should handle Promise return from super.canActivate', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      const superCanActivate = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate');
      superCanActivate.mockReturnValue(Promise.resolve(true));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      superCanActivate.mockRestore();
    });
  });
});
