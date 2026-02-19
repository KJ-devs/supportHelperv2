import { Test, TestingModule } from '@nestjs/testing';
import { SetupService } from '../../../src/modules/setup/setup.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuthService } from '../../../src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, BadRequestException } from '@nestjs/common';

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      models: {
        list: jest.fn().mockResolvedValue({ data: [] }),
      },
    })),
  };
});

// Mocks for nodemailer transport methods — reassigned per test
const mockVerify = jest.fn();
const mockSendMail = jest.fn();
const mockClose = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    verify: mockVerify,
    sendMail: mockSendMail,
    close: mockClose,
  })),
}));

describe('SetupService', () => {
  let service: SetupService;
  let prismaService: jest.Mocked<PrismaService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupService,
        {
          provide: PrismaService,
          useValue: {
            systemConfig: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            user: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SetupService>(SetupService);
    prismaService = module.get(PrismaService);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isSetupCompleted', () => {
    it('should return false when setup_completed config does not exist', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.isSetupCompleted();

      expect(result).toBe(false);
      expect(prismaService.systemConfig.findUnique).toHaveBeenCalledWith({
        where: { key: 'setup_completed' },
      });
    });

    it('should return true when setup is completed', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        key: 'setup_completed',
        value: { completed: true },
      });

      const result = await service.isSetupCompleted();

      expect(result).toBe(true);
    });

    it('should return false when setup is not completed', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        key: 'setup_completed',
        value: { completed: false },
      });

      const result = await service.isSetupCompleted();

      expect(result).toBe(false);
    });
  });

  describe('getSetupProgress', () => {
    it('should return default progress when no config exists', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getSetupProgress();

      expect(result).toEqual({
        currentStep: 1,
        completedSteps: [],
      });
    });

    it('should return saved progress', async () => {
      (prismaService.systemConfig.findUnique as jest.Mock).mockResolvedValue({
        key: 'setup_progress',
        value: {
          currentStep: 3,
          completedSteps: ['admin', 'ai-key', 'smtp'],
        },
      });

      const result = await service.getSetupProgress();

      expect(result).toEqual({
        currentStep: 3,
        completedSteps: ['admin', 'ai-key', 'smtp'],
      });
    });
  });

  describe('createAdmin', () => {
    it('should throw ConflictException if users already exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.createAdmin({
          email: 'admin@example.com',
          password: 'password123',
          name: 'Admin User',
          organizationName: 'Test Org',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create admin user when no users exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);
      (authService.register as jest.Mock).mockResolvedValue({
        user: {
          id: 'user-123',
          tenantId: 'tenant-123',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'owner',
          createdAt: new Date(),
        },
        accessToken: 'token',
        refreshToken: 'refresh-token',
      });

      const result = await service.createAdmin({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        organizationName: 'Test Org',
      });

      expect(result).toBeDefined();
      expect(result.user.email).toBe('admin@example.com');
      expect(authService.register).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        tenantName: 'Test Org',
      });
    });
  });

  describe('saveSetupProgress', () => {
    it('should save progress to system config', async () => {
      (prismaService.systemConfig.upsert as jest.Mock).mockResolvedValue({});

      await service.saveSetupProgress({
        currentStep: 2,
        completedSteps: ['admin'],
      });

      expect(prismaService.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'setup_progress' },
        create: {
          key: 'setup_progress',
          value: {
            currentStep: 2,
            completedSteps: ['admin'],
          },
        },
        update: {
          value: {
            currentStep: 2,
            completedSteps: ['admin'],
          },
        },
      });
    });
  });

  describe('completeSetup', () => {
    it('should throw BadRequestException if no users exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await expect(service.completeSetup()).rejects.toThrow(BadRequestException);
    });

    it('should mark setup as completed when users exist', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(1);
      (prismaService.systemConfig.upsert as jest.Mock).mockResolvedValue({});

      const result = await service.completeSetup();

      expect(result).toEqual({ success: true });
      expect(prismaService.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'setup_completed' },
        create: {
          key: 'setup_completed',
          value: { completed: true },
        },
        update: {
          value: { completed: true },
        },
      });
    });
  });

  describe('testSmtp', () => {
    const validDto = {
      host: 'smtp.example.com',
      port: 587,
      username: 'user@example.com',
      password: 'secret',
      fromEmail: 'noreply@example.com',
      secure: false,
    };

    beforeEach(() => {
      mockVerify.mockReset();
      mockSendMail.mockReset();
      mockClose.mockReset();
    });

    it('should return success when SMTP connection and test email both succeed', async () => {
      mockVerify.mockResolvedValue(true);
      mockSendMail.mockResolvedValue({ messageId: 'test-id' });

      const result = await service.testSmtp(validDto);

      expect(result).toEqual({ success: true });
      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: validDto.fromEmail,
          to: validDto.fromEmail,
          subject: 'Support Helper - SMTP Test',
        }),
      );
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should return success even when test email send fails after connection succeeds', async () => {
      mockVerify.mockResolvedValue(true);
      mockSendMail.mockRejectedValue(new Error('Send quota exceeded'));

      const result = await service.testSmtp(validDto);

      expect(result).toEqual({ success: true });
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should return failure with missing-field error when host is absent', async () => {
      const result = await service.testSmtp({
        ...validDto,
        host: '',
      });

      expect(result).toEqual({
        success: false,
        error: 'Missing required SMTP configuration fields',
      });
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('should return failure with missing-field error when fromEmail is absent', async () => {
      const result = await service.testSmtp({
        ...validDto,
        fromEmail: '',
      });

      expect(result).toEqual({
        success: false,
        error: 'Missing required SMTP configuration fields',
      });
    });

    it('should return failure with missing-field error when port is 0 (falsy)', async () => {
      // Port 0 is falsy, so the missing-field guard triggers before the range check
      const result = await service.testSmtp({ ...validDto, port: 0 });

      expect(result).toEqual({
        success: false,
        error: 'Missing required SMTP configuration fields',
      });
    });

    it('should return failure with invalid-port error when port exceeds 65535', async () => {
      const result = await service.testSmtp({ ...validDto, port: 70000 });

      expect(result).toEqual({
        success: false,
        error: 'Invalid SMTP port number',
      });
    });

    it('should return timeout error message for ETIMEDOUT', async () => {
      const err = Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timed out/i);
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should return timeout error message for ESOCKET', async () => {
      const err = Object.assign(new Error('Socket error'), { code: 'ESOCKET' });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timed out/i);
    });

    it('should return connection refused error message for ECONNREFUSED', async () => {
      const err = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/connection refused/i);
    });

    it('should return hostname-not-found error message for ENOTFOUND', async () => {
      const err = Object.assign(new Error("getaddrinfo ENOTFOUND 'smtp.bad-host.com'"), { code: 'ENOTFOUND' });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/hostname not found/i);
    });

    it('should return auth failed error message for EAUTH code', async () => {
      const err = Object.assign(new Error('535 Authentication failed'), { code: 'EAUTH' });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/authentication failed/i);
    });

    it('should return auth failed error message when message contains "Invalid login"', async () => {
      const err = Object.assign(new Error('535 Invalid login'), { code: undefined });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/authentication failed/i);
    });

    it('should return TLS certificate error message for self-signed certificate', async () => {
      const err = Object.assign(new Error('self-signed certificate in chain'), { code: undefined });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/TLS certificate error/i);
    });

    it('should return TLS certificate error message for UNABLE_TO_VERIFY_LEAF_SIGNATURE', async () => {
      const err = Object.assign(new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE'), { code: undefined });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/TLS certificate error/i);
    });

    it('should return connection reset error message for ECONNRESET', async () => {
      const err = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/reset by the server/i);
    });

    it('should return raw error message for unrecognised errors', async () => {
      const err = new Error('Unexpected SMTP server error');
      mockVerify.mockRejectedValue(err);

      const result = await service.testSmtp(validDto);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected SMTP server error');
    });

    it('should create transport with correct options including 10-second timeouts', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as { createTransport: jest.Mock };
      mockVerify.mockResolvedValue(true);
      mockSendMail.mockResolvedValue({});

      await service.testSmtp(validDto);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: validDto.host,
          port: validDto.port,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 10_000,
        }),
      );
    });

    it('should omit auth when no username is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as { createTransport: jest.Mock };
      mockVerify.mockResolvedValue(true);
      mockSendMail.mockResolvedValue({});

      await service.testSmtp({ ...validDto, username: undefined, password: undefined });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      );
    });

    it('should default secure to true when port is 465 and secure is not set', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as { createTransport: jest.Mock };
      mockVerify.mockResolvedValue(true);
      mockSendMail.mockResolvedValue({});

      await service.testSmtp({ ...validDto, port: 465, secure: undefined });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
      );
    });
  });
});
