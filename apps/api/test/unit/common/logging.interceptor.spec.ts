import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../../../src/common/interceptors/logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  const mockRequest = {
    method: 'GET',
    url: '/api/test',
    body: {},
    get: jest.fn((header: string) => {
      if (header === 'user-agent') return 'Mozilla/5.0';
      return null;
    }),
  };

  const mockResponse = {
    statusCode: 200,
    get: jest.fn((header: string) => {
      if (header === 'content-length') return '1234';
      return null;
    }),
  };

  const mockExecutionContext: ExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  };

  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);

    // Suppress logger output in tests
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should log incoming request with method, url, and user agent', () => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('→ GET /api/test Mozilla/5.0')
      );
    });

    it('should log request with body when present', () => {
      const requestWithBody = {
        ...mockRequest,
        body: { name: 'test', value: 123 },
      };

      const contextWithBody: ExecutionContext = {
        ...mockExecutionContext,
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => requestWithBody,
          getResponse: () => mockResponse,
        }),
      };

      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      interceptor.intercept(contextWithBody, mockCallHandler);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Body: {"name":"test","value":123}]')
      );
    });

    it('should not log body when empty', () => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      const logMessage = logSpy.mock.calls[0][0];
      expect(logMessage).not.toContain('[Body:');
    });

    it('should handle missing user-agent header', () => {
      const requestWithoutUA = {
        ...mockRequest,
        get: jest.fn(() => null),
      };

      const contextWithoutUA: ExecutionContext = {
        ...mockExecutionContext,
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => requestWithoutUA,
          getResponse: () => mockResponse,
        }),
      };

      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      interceptor.intercept(contextWithoutUA, mockCallHandler);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('→ GET /api/test ')
      );
    });

    it('should log successful response with status, size, and duration', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringMatching(/← GET \/api\/test 200 1234b - \d+ms/)
        );
        done();
      });
    });

    it('should use 0 for content-length when not present', (done) => {
      const responseWithoutLength = {
        ...mockResponse,
        get: jest.fn(() => null),
      };

      const contextWithoutLength: ExecutionContext = {
        ...mockExecutionContext,
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => responseWithoutLength,
        }),
      };

      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      const observable = interceptor.intercept(contextWithoutLength, mockCallHandler);

      observable.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('0b')
        );
        done();
      });
    });

    it('should log error with status and duration', (done) => {
      const error = { status: 404, message: 'Not found' };
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => error)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/✗ GET \/api\/test 404 - \d+ms/)
          );
          done();
        },
      });
    });

    it('should use status 500 for errors without status', (done) => {
      const error = new Error('Unknown error');
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(throwError(() => error)),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/✗ GET \/api\/test 500 - \d+ms/)
          );
          done();
        },
      });
    });

    it('should measure elapsed time accurately', (done) => {
      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ data: 'test' })),
      };

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      observable.subscribe(() => {
        // Find the response log (contains ← symbol)
        const responseCalls = logSpy.mock.calls.filter(call =>
          typeof call[0] === 'string' && call[0].includes('←')
        );
        expect(responseCalls.length).toBeGreaterThan(0);
        const logMessage = responseCalls[0][0] as string;
        const match = logMessage.match(/(\d+)ms/);
        expect(match).toBeTruthy();
        const duration = parseInt(match![1]);
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      });
    });

    it('should handle POST requests', (done) => {
      const postRequest = { ...mockRequest, method: 'POST', url: '/api/create' };
      const postContext: ExecutionContext = {
        ...mockExecutionContext,
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => postRequest,
          getResponse: () => mockResponse,
        }),
      };

      const mockCallHandler: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ id: 'new-item' })),
      };

      const observable = interceptor.intercept(postContext, mockCallHandler);

      observable.subscribe(() => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('→ POST /api/create')
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('← POST /api/create')
        );
        done();
      });
    });
  });
});
