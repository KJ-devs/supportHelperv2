import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  const mockRequest = {
    method: 'GET',
    url: '/api/test',
  };

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const mockArgumentsHost: ArgumentsHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    getArgByIndex: jest.fn(),
    getArgs: jest.fn(),
    getType: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle HttpException with string message', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Internal Server Error', // Default value when response is string
        message: 'Test error',
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle HttpException with object response', () => {
      const exception = new BadRequestException({
        message: 'Validation failed',
        error: 'ValidationError',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'ValidationError',
        message: 'Validation failed',
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle HttpException with array message', () => {
      const exception = new BadRequestException({
        message: ['field1 is required', 'field2 is invalid'],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ['field1 is required', 'field2 is invalid'],
        })
      );
    });

    it('should handle NotFoundException', () => {
      const exception = new NotFoundException('Resource not found');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Resource not found',
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle standard Error', () => {
      const exception = new Error('Standard error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Error',
        message: 'Standard error',
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should handle unknown exception type', () => {
      const exception = 'Unknown error string';

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Internal server error',
        timestamp: expect.any(String),
        path: '/api/test',
      });
    });

    it('should log error with stack trace for Error instances', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new Error('Test error with stack');

      filter.catch(exception, mockArgumentsHost);

      expect(errorSpy).toHaveBeenCalledWith(
        'GET /api/test',
        exception.stack
      );
    });

    it('should log error for HttpException instances', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = new BadRequestException('Bad request');

      filter.catch(exception, mockArgumentsHost);

      expect(errorSpy).toHaveBeenCalledWith(
        'GET /api/test',
        exception.stack
      );
    });

    it('should log exception for unknown error types', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const exception = { custom: 'error' };

      filter.catch(exception, mockArgumentsHost);

      expect(errorSpy).toHaveBeenCalledWith(
        'GET /api/test',
        exception
      );
    });

    it('should include timestamp in ISO format', () => {
      const exception = new HttpException('Test', HttpStatus.OK);
      const beforeTime = new Date().toISOString();

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      const afterTime = new Date().toISOString();

      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(response.timestamp >= beforeTime).toBe(true);
      expect(response.timestamp <= afterTime).toBe(true);
    });

    it('should handle different HTTP methods', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const postRequest = { method: 'POST', url: '/api/create' };
      const postMockHost: ArgumentsHost = {
        ...mockArgumentsHost,
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => postRequest,
          getResponse: () => mockResponse,
        }),
      };

      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, postMockHost);

      expect(errorSpy).toHaveBeenCalledWith(
        'POST /api/create',
        expect.anything()
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/create' })
      );
    });

    it('should handle HttpException with missing error field in object response', () => {
      const exception = new HttpException(
        { message: 'Custom message' },
        HttpStatus.FORBIDDEN
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal Server Error', // Default value when not provided
          message: 'Custom message',
        })
      );
    });

    it('should handle HttpException with missing message field in object response', () => {
      const exception = new HttpException(
        { error: 'CustomError' },
        HttpStatus.UNAUTHORIZED
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'CustomError',
          message: 'Internal server error', // Default value when not provided
        })
      );
    });
  });
});
