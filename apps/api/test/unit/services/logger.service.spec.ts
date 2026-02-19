import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerService, getCorrelationId, runWithCorrelationId, generateCorrelationId } from '../../../src/monitoring/logger.service';
import * as winston from 'winston';
import { Logtail } from '@logtail/node';

// Mock dependencies
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    combine: jest.fn(),
    colorize: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

jest.mock('@logtail/node');
jest.mock('@logtail/winston', () => ({
  LogtailTransport: jest.fn(),
}));

describe('LoggerService', () => {
  let service: LoggerService;
  let configService: jest.Mocked<ConfigService>;
  let mockLogger: any;

  beforeEach(async () => {
    // Mock winston logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

    configService = {
      get: jest.fn(),
    } as unknown;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with console transport in development', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'app.nodeEnv') return 'development';
        if (key === 'monitoring.betterStack.sourceToken') return null;
        if (key === 'monitoring.betterStack.enabled') return false;
        return null;
      });

      const newService = new LoggerService(configService);

      expect(winston.createLogger).toHaveBeenCalled();
      expect(winston.transports.Console).toHaveBeenCalled();
    });

    it('should initialize with BetterStack transport when enabled', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'app.nodeEnv') return 'production';
        if (key === 'monitoring.betterStack.sourceToken') return 'test-token';
        if (key === 'monitoring.betterStack.enabled') return true;
        if (key === 'app.version') return '1.0.0';
        return null;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const newService = new LoggerService(configService);

      expect(Logtail).toHaveBeenCalledWith('test-token');
      expect(consoleSpy).toHaveBeenCalledWith('[Logger] Better Stack transport enabled');
      consoleSpy.mockRestore();
    });

    it('should not initialize BetterStack when disabled', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'app.nodeEnv') return 'production';
        if (key === 'monitoring.betterStack.sourceToken') return 'test-token';
        if (key === 'monitoring.betterStack.enabled') return false;
        return null;
      });

      const newService = new LoggerService(configService);

      expect(Logtail).not.toHaveBeenCalled();
    });
  });

  describe('setContext', () => {
    it('should set the context', () => {
      service.setContext('TestContext');
      service.log('test message');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'test message',
        expect.objectContaining({
          context: 'TestContext',
        })
      );
    });
  });

  describe('log', () => {
    it('should log info message with string', () => {
      service.log('test message');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'test message',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });

    it('should log info message with Error object', () => {
      const error = new Error('test error');
      service.log(error);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'test error',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });

    it('should log info message with object', () => {
      const obj = { key: 'value' };
      service.log(obj);

      expect(mockLogger.info).toHaveBeenCalledWith(
        JSON.stringify(obj),
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });

    it('should include context from optional params', () => {
      service.log('test message', 'CustomContext');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'test message',
        expect.objectContaining({
          context: 'CustomContext',
        })
      );
    });

    it('should include error details from optional params', () => {
      const error = new Error('test error');
      service.log('test message', error);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'test message',
        expect.objectContaining({
          error: {
            name: 'Error',
            message: 'test error',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should merge object metadata from optional params', () => {
      service.log('test message', { userId: '123', action: 'login' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'test message',
        expect.objectContaining({
          userId: '123',
          action: 'login',
        })
      );
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      service.error('error message');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'error message',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });

    it('should log error with Error object and metadata', () => {
      const error = new Error('test error');
      service.error('Failed operation', error, { userId: '123' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed operation',
        expect.objectContaining({
          error: {
            name: 'Error',
            message: 'test error',
            stack: expect.any(String),
          },
          userId: '123',
        })
      );
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      service.warn('warning message');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'warning message',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      service.debug('debug message');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'debug message',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });
  });

  describe('verbose', () => {
    it('should log verbose message', () => {
      service.verbose('verbose message');

      expect(mockLogger.verbose).toHaveBeenCalledWith(
        'verbose message',
        expect.objectContaining({
          correlationId: expect.any(String),
        })
      );
    });
  });

  describe('logRequest', () => {
    it('should log HTTP request with structured data', () => {
      service.logRequest('GET', '/api/tickets', 200, 125, { userId: 'user-1' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HTTP Request',
        expect.objectContaining({
          http: {
            method: 'GET',
            url: '/api/tickets',
            statusCode: 200,
            duration: 125,
          },
          userId: 'user-1',
          correlationId: expect.any(String),
        })
      );
    });

    it('should log HTTP request without optional metadata', () => {
      service.logRequest('POST', '/api/auth/login', 201, 89);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'HTTP Request',
        expect.objectContaining({
          http: {
            method: 'POST',
            url: '/api/auth/login',
            statusCode: 201,
            duration: 89,
          },
        })
      );
    });
  });

  describe('logDatabaseQuery', () => {
    it('should log database query with truncated SQL', () => {
      const longQuery = 'SELECT * FROM tickets WHERE '.repeat(50);
      service.logDatabaseQuery(longQuery, 45, { tenantId: 'tenant-1' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Database Query',
        expect.objectContaining({
          database: {
            query: expect.stringContaining('SELECT'),
            duration: 45,
          },
          tenantId: 'tenant-1',
        })
      );

      const call = mockLogger.debug.mock.calls[0];
      expect(call[1].database.query.length).toBeLessThanOrEqual(500);
    });

    it('should log short database query without truncation', () => {
      const query = 'SELECT id FROM users WHERE email = ?';
      service.logDatabaseQuery(query, 12);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Database Query',
        expect.objectContaining({
          database: {
            query,
            duration: 12,
          },
        })
      );
    });
  });

  describe('logExternalService', () => {
    it('should log successful external service call', () => {
      service.logExternalService('OpenAI', 'analyze-video', 1234, true, { model: 'gpt-4' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'External Service Call',
        expect.objectContaining({
          external: {
            service: 'OpenAI',
            operation: 'analyze-video',
            duration: 1234,
            success: true,
          },
          model: 'gpt-4',
        })
      );
    });

    it('should log failed external service call', () => {
      service.logExternalService('GitHub', 'create-issue', 456, false, { error: 'API rate limit' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'External Service Call',
        expect.objectContaining({
          external: {
            service: 'GitHub',
            operation: 'create-issue',
            duration: 456,
            success: false,
          },
          error: 'API rate limit',
        })
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event with user ID', () => {
      service.logSecurityEvent('failed_login', 'user-123', { ip: '192.168.1.1' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          security: {
            event: 'failed_login',
            userId: 'user-123',
          },
          ip: '192.168.1.1',
        })
      );
    });

    it('should log security event without user ID', () => {
      service.logSecurityEvent('invalid_token', undefined, { token: 'abc***' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security Event',
        expect.objectContaining({
          security: {
            event: 'invalid_token',
            userId: undefined,
          },
          token: 'abc***',
        })
      );
    });
  });

  describe('flush', () => {
    it('should flush logtail when enabled', async () => {
      const mockFlush = jest.fn().mockResolvedValue(undefined);
      (service as unknown).logtail = { flush: mockFlush };

      await service.flush();

      expect(mockFlush).toHaveBeenCalled();
    });

    it('should not throw when logtail is not enabled', async () => {
      (service as unknown).logtail = null;

      await expect(service.flush()).resolves.not.toThrow();
    });
  });
});

describe('Correlation ID utilities', () => {
  describe('generateCorrelationId', () => {
    it('should generate a UUID', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('runWithCorrelationId', () => {
    it('should run function with correlation ID', () => {
      const testId = 'test-correlation-id';
      let capturedId: string | undefined;

      runWithCorrelationId(testId, () => {
        capturedId = getCorrelationId();
      });

      expect(capturedId).toBe(testId);
    });

    it('should return function result', () => {
      const result = runWithCorrelationId('test-id', () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it('should isolate correlation ID per execution context', () => {
      const id1 = 'id-1';
      const id2 = 'id-2';

      const result1 = runWithCorrelationId(id1, () => getCorrelationId());
      const result2 = runWithCorrelationId(id2, () => getCorrelationId());

      expect(result1).toBe(id1);
      expect(result2).toBe(id2);
    });
  });

  describe('getCorrelationId', () => {
    it('should return "no-correlation-id" when not in context', () => {
      const id = getCorrelationId();
      expect(id).toBe('no-correlation-id');
    });

    it('should return correlation ID when in context', () => {
      const testId = 'test-correlation-id';
      runWithCorrelationId(testId, () => {
        expect(getCorrelationId()).toBe(testId);
      });
    });
  });
});
