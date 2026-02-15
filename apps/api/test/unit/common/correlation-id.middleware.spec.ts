// Mock uuid before imports
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-uuid-1234'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { CorrelationIdMiddleware } from '../../../src/monitoring/correlation-id.middleware';
import { generateCorrelationId, runWithCorrelationId } from '../../../src/monitoring/logger.service';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should use existing correlation ID from header', () => {
      const existingId = 'existing-correlation-id';
      const mockRequest = {
        headers: {
          'x-correlation-id': existingId,
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      expect((mockRequest as any).correlationId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', existingId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should generate new correlation ID when header is missing', () => {
      const mockRequest = {
        headers: {},
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      expect((mockRequest as any).correlationId).toBe('generated-uuid-1234');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', 'generated-uuid-1234');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set correlation ID on request object', () => {
      const mockRequest = {
        headers: {
          'x-correlation-id': 'test-id',
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      expect((mockRequest as Request & { correlationId: string }).correlationId).toBe('test-id');
    });

    it('should set correlation ID in response header', () => {
      const correlationId = 'response-test-id';
      const mockRequest = {
        headers: {
          'x-correlation-id': correlationId,
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', correlationId);
    });

    it('should call next function', () => {
      const mockRequest = {
        headers: {},
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle case-sensitive header name', () => {
      const mockRequest = {
        headers: {
          'X-Correlation-Id': 'uppercase-id', // Wrong case
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      // Should generate new ID since lowercase header is not found
      expect((mockRequest as any).correlationId).toBe('generated-uuid-1234');
    });

    it('should handle empty correlation ID header', () => {
      const mockRequest = {
        headers: {
          'x-correlation-id': '',
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      // Empty string is falsy, should generate new ID
      expect((mockRequest as any).correlationId).toBe('generated-uuid-1234');
    });

    it('should run next callback with correlation ID context', () => {
      const mockRequest = {
        headers: {
          'x-correlation-id': 'context-test-id',
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      // Verify that next was called (context is set internally)
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve correlation ID through the request lifecycle', () => {
      const correlationId = 'lifecycle-test-id';
      const mockRequest = {
        headers: {
          'x-correlation-id': correlationId,
        },
      } as unknown as Request;
      const mockResponse = {
        setHeader: jest.fn(),
      } as unknown as Response;
      const mockNext = jest.fn() as NextFunction;

      middleware.use(mockRequest, mockResponse, mockNext);

      // Verify both request and response have the same correlation ID
      expect((mockRequest as any).correlationId).toBe(correlationId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', correlationId);
    });
  });
});
