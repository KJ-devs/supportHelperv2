import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from '../../../src/common/interceptors/transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  const mockRequest = {
    url: '/api/test',
  };

  const mockExecutionContext: ExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => mockRequest,
      getResponse: () => ({}),
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should wrap response data in standard format', (done) => {
      const responseData = { id: '123', name: 'Test' };
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(responseData)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result).toHaveProperty('data', responseData);
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('path', '/api/test');
        done();
      });
    });

    it('should include timestamp in ISO format', (done) => {
      const responseData = { message: 'Success' };
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(responseData)),
      };
      const beforeTime = new Date().toISOString();

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        const afterTime = new Date().toISOString();
        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
        expect(result.timestamp >= beforeTime).toBe(true);
        expect(result.timestamp <= afterTime).toBe(true);
        done();
      });
    });

    it('should include request path from context', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.path).toBe('/api/test');
        done();
      });
    });

    it('should handle array data', (done) => {
      const responseData = [{ id: 1 }, { id: 2 }];
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(responseData)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toEqual(responseData);
        expect(Array.isArray(result.data)).toBe(true);
        done();
      });
    });

    it('should handle null data', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(null)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toBeNull();
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('path');
        done();
      });
    });

    it('should handle undefined data', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(undefined)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toBeUndefined();
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('path');
        done();
      });
    });

    it('should handle primitive data types', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of('success')),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toBe('success');
        done();
      });
    });

    it('should handle number data', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(42)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toBe(42);
        done();
      });
    });

    it('should handle boolean data', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(true)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toBe(true);
        done();
      });
    });

    it('should handle different URL paths', (done) => {
      const customRequest = { url: '/api/users/123/profile' };
      const customContext: ExecutionContext = {
        ...mockExecutionContext,
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => customRequest,
          getResponse: () => ({}),
        }),
      };

      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ user: 'data' })),
      };

      const observable = interceptor.intercept(customContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.path).toBe('/api/users/123/profile');
        done();
      });
    });

    it('should handle nested object data', (done) => {
      const responseData = {
        user: { id: 1, name: 'Test' },
        metadata: { created: new Date().toISOString() },
      };
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of(responseData)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe((result) => {
        expect(result.data).toEqual(responseData);
        expect(result.data.user.id).toBe(1);
        expect(result.data.metadata).toBeDefined();
        done();
      });
    });
  });
});
