import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DlqAlertService } from '../dlq-alert.service';
import { EmailService } from '../email.service';
import { Job } from 'bullmq';

// Mock ioredis before any imports that may pull it in
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    exists: jest.fn().mockResolvedValue(0),
    set: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DlqAlertService', () => {
  let service: DlqAlertService;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;
  let mockRedis: {
    exists: jest.Mock;
    set: jest.Mock;
    quit: jest.Mock;
  };

  const makeMockJob = (overrides: Partial<Job> = {}): Job => ({
    id: 'job-abc',
    queueName: 'video-analysis',
    data: { tenantId: 'tenant-1', ticketId: 'ticket-1', mediaId: 'media-1' },
    failedReason: 'FFmpeg extraction failed',
    attemptsMade: 4,
    stacktrace: ['Error: FFmpeg failed', '  at VideoWorker.process'],
    ...overrides,
  } as unknown as Job);

  beforeEach(async () => {
    mockRedis = {
      exists: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    };

    // Reset and re-mock ioredis with fresh mockRedis instance
    const Redis = require('ioredis');
    (Redis as jest.Mock).mockImplementation(() => mockRedis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqAlertService,
        {
          provide: EmailService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({ id: 'email-id-123' }),
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

    service = module.get<DlqAlertService>(DlqAlertService);
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);

    // Trigger onModuleInit to initialize Redis
    await service.onModuleInit();

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // alertIfNeeded – routing logic
  // ═══════════════════════════════════════════════════════════════════════

  describe('alertIfNeeded', () => {
    it('should skip alerts for non-critical queues', async () => {
      const job = makeMockJob({ queueName: 'integration-sync' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send alerts for video-analysis queue', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should send alerts for agent-orchestration queue', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'agent-orchestration' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should send alerts for github-sync queue', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'github-sync' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should send alerts for backup queue', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'backup' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Throttling
  // ═══════════════════════════════════════════════════════════════════════

  describe('throttling', () => {
    it('should skip alert when queue is throttled (Redis key exists)', async () => {
      // Redis returns 1 → key already exists → throttled
      mockRedis.exists.mockResolvedValue(1);

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should mark queue as throttled after sending alert', async () => {
      mockRedis.exists.mockResolvedValue(0); // Not throttled

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      // Should have set the throttle key with 5-min TTL
      expect(mockRedis.set).toHaveBeenCalledWith(
        'dlq:alert:throttle:video-analysis',
        '1',
        'EX',
        300, // 5 * 60 seconds
      );
    });

    it('should allow alert if Redis is down (fail open)', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis connection refused'));
      mockRedis.set.mockRejectedValue(new Error('Redis connection refused'));

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      // Should not throw and should still send email
      await expect(service.alertIfNeeded(job)).resolves.toBeUndefined();
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Email alerts
  // ═══════════════════════════════════════════════════════════════════════

  describe('email alerts', () => {
    it('should skip email when DLQ_ALERT_EMAIL is not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should skip email when email service is disabled', async () => {
      (emailService.isEnabled as jest.Mock).mockReturnValue(false);

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should send email with correct subject', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'ops@example.com',
          subject: '[DLQ ALERT] video-analysis job failed permanently',
        }),
      );
    });

    it('should include job details in email body', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({
        queueName: 'video-analysis',
        id: 'job-xyz',
        attemptsMade: 5,
        failedReason: 'FFmpeg extraction failed',
      } as Partial<Job>);

      await service.alertIfNeeded(job);

      const callArgs = (emailService.send as jest.Mock).mock.calls[0][0];

      expect(callArgs.html).toContain('video-analysis');
      expect(callArgs.html).toContain('job-xyz');
      expect(callArgs.html).toContain('5'); // attemptsMade
      expect(callArgs.html).toContain('FFmpeg extraction failed');
    });

    it('should include stacktrace in email when present', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({
        queueName: 'video-analysis',
        stacktrace: ['Error: FFmpeg failed', '  at VideoWorker.process', '  at async Worker.run'],
      } as Partial<Job>);

      await service.alertIfNeeded(job);

      const callArgs = (emailService.send as jest.Mock).mock.calls[0][0];
      expect(callArgs.html).toContain('Stack Trace');
      expect(callArgs.html).toContain('FFmpeg failed');
    });

    it('should not throw if emailService.send rejects', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });
      (emailService.send as jest.Mock).mockRejectedValue(new Error('Resend API error'));

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await expect(service.alertIfNeeded(job)).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Slack alerts
  // ═══════════════════════════════════════════════════════════════════════

  describe('Slack alerts', () => {
    it('should skip Slack alert when DLQ_SLACK_WEBHOOK_URL is not set', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send Slack alert when DLQ_SLACK_WEBHOOK_URL is configured', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/services/test/webhook';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should include queue name and job details in Slack message', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/services/test/webhook';
        return undefined;
      });

      const job = makeMockJob({
        queueName: 'agent-orchestration',
        id: 'job-777',
        failedReason: 'OpenAI API timeout',
        attemptsMade: 3,
      } as Partial<Job>);

      await service.alertIfNeeded(job);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body) as {
        text: string;
        blocks: Array<{ type: string; fields?: Array<{ text: string }> }>;
      };

      expect(body.text).toContain('agent-orchestration');
      // The blocks contain the job details
      const sectionBlock = body.blocks.find(
        (b: { type: string }) => b.type === 'section' && 'fields' in b,
      ) as { type: string; fields: Array<{ text: string }> } | undefined;
      expect(sectionBlock?.fields?.some((f) => f.text.includes('agent-orchestration'))).toBe(true);
      expect(sectionBlock?.fields?.some((f) => f.text.includes('job-777'))).toBe(true);
    });

    it('should not throw if Slack webhook returns non-200', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429 });

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/services/test/webhook';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await expect(service.alertIfNeeded(job)).resolves.toBeUndefined();
    });

    it('should not throw if fetch rejects (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network unreachable'));

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/services/test/webhook';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await expect(service.alertIfNeeded(job)).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Both email + Slack simultaneously
  // ═══════════════════════════════════════════════════════════════════════

  describe('combined alerts', () => {
    it('should send both email and Slack when both are configured', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        if (key === 'DLQ_SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/services/test/webhook';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      expect(emailService.send).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should still send Slack if email fails', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      (emailService.send as jest.Mock).mockRejectedValue(new Error('Resend down'));

      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        if (key === 'DLQ_SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/services/test/webhook';
        return undefined;
      });

      const job = makeMockJob({ queueName: 'video-analysis' } as Partial<Job>);

      await service.alertIfNeeded(job);

      // Slack should still be called despite email failure
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Payload handling edge cases
  // ═══════════════════════════════════════════════════════════════════════

  describe('payload edge cases', () => {
    it('should handle job with undefined id', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      const job = makeMockJob({
        queueName: 'video-analysis',
        id: undefined,
        failedReason: undefined,
        stacktrace: undefined,
      } as Partial<Job>);

      await expect(service.alertIfNeeded(job)).resolves.toBeUndefined();
      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    it('should truncate large payloads in email body', async () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'DLQ_ALERT_EMAIL') return 'ops@example.com';
        return undefined;
      });

      // Create job with a large payload (> 500 chars when serialised)
      const largePayload = { data: 'x'.repeat(1000) };
      const job = makeMockJob({
        queueName: 'video-analysis',
        data: largePayload,
      } as Partial<Job>);

      await service.alertIfNeeded(job);

      const callArgs = (emailService.send as jest.Mock).mock.calls[0][0];
      // The HTML should contain the truncated payload (≤ 500 chars of JSON)
      const preTagContent = callArgs.html.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] as string | undefined;
      expect(preTagContent).toBeDefined();
      expect(preTagContent!.length).toBeLessThanOrEqual(510); // 500 + some HTML overhead
    });
  });
});
