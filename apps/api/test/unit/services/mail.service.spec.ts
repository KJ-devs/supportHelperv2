import { ConfigService } from '@nestjs/config';
import { MailService } from '../../../src/common/mail/mail.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EncryptionService } from '../../../src/common/services/encryption.service';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail, close: jest.fn() }));
jest.mock('nodemailer', () => ({ createTransport: (opts: unknown) => mockCreateTransport(opts) }));

const mockResendSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockResendSend } })),
}));

describe('MailService', () => {
  let env: Record<string, string | undefined>;
  let storedSmtp: unknown;
  let service: MailService;

  const message = { to: 'user@test.local', subject: 'Hello', html: '<p>Hi</p>' };

  beforeEach(() => {
    jest.clearAllMocks();
    env = {};
    storedSmtp = null;
    const config = { get: (key: string) => env[key] } as unknown as ConfigService;
    const prisma = {
      systemConfig: {
        findUnique: jest.fn(async () => (storedSmtp ? { value: storedSmtp } : null)),
      },
    } as unknown as PrismaService;
    const encryption = {
      decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')),
    } as unknown as EncryptionService;
    jest.spyOn(EncryptionService, 'isEncrypted').mockImplementation((v: string) => v.startsWith('enc:'));
    service = new MailService(config, prisma, encryption);
  });

  it('uses Resend when an API key is configured', async () => {
    env.RESEND_API_KEY = 're_test';
    mockResendSend.mockResolvedValue({ data: { id: '1' }, error: null });

    await expect(service.send(message)).resolves.toBe(true);
    expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@test.local' }));
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('prefers the SMTP saved in the setup wizard and decrypts its password', async () => {
    env.SMTP_HOST = 'env-host';
    storedSmtp = { host: 'wizard-host', port: 587, username: 'u', password: 'enc:secret', fromEmail: 'a@b.c' };

    await service.send(message);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'wizard-host', auth: { user: 'u', pass: 'secret' } }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'a@b.c', subject: 'Hello' }));
  });

  it('falls back to SMTP environment variables (MailHog in development)', async () => {
    env.SMTP_HOST = 'localhost';
    env.SMTP_PORT = '1025';

    await service.send(message);

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 1025, auth: undefined }),
    );
  });

  it('skips sending when no transport is configured', async () => {
    await expect(service.send(message)).resolves.toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
