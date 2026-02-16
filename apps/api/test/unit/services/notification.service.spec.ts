import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationService } from '../../../src/modules/notifications/notification.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;
  let queue: Queue;

  const mockPrismaService = {
    notificationPreference: {
      findMany: jest.fn(),
    },
    notificationLog: {
      create: jest.fn(),
    },
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('send-notification'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
    queue = module.get<Queue>(getQueueToken('send-notification'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatchNotification', () => {
    it('should dispatch notifications for matching preferences', async () => {
      const params = {
        ticketId: 'ticket-123',
        tenantId: 'tenant-123',
        applicationId: 'app-123',
        eventType: 'ticket_created',
        data: { ticketTitle: 'Bug report' },
      };

      const preferences = [
        {
          id: 'pref-1',
          applicationId: 'app-123',
          tenantId: 'tenant-123',
          channel: 'email',
          events: ['ticket_created'],
          enabled: true,
          config: { recipients: ['admin@example.com'] },
        },
        {
          id: 'pref-2',
          applicationId: 'app-123',
          tenantId: 'tenant-123',
          channel: 'slack',
          events: [], // empty = all events
          enabled: true,
          config: { webhook: 'https://hooks.slack.com/xxx' },
        },
      ];

      mockPrismaService.notificationPreference.findMany.mockResolvedValue(preferences);

      await service.dispatchNotification(params);

      expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
        where: {
          applicationId: 'app-123',
          tenantId: 'tenant-123',
          enabled: true,
        },
      });

      expect(queue.add).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          ticketId: 'ticket-123',
          channel: 'email',
          eventType: 'ticket_created',
          preferenceId: 'pref-1',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }),
      );

      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
    });

    it('should not dispatch when no enabled preferences exist', async () => {
      const params = {
        ticketId: 'ticket-456',
        tenantId: 'tenant-456',
        applicationId: 'app-456',
        eventType: 'ticket_updated',
        data: {},
      };

      mockPrismaService.notificationPreference.findMany.mockResolvedValue([]);

      await service.dispatchNotification(params);

      expect(queue.add).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('should not dispatch when event type does not match preference', async () => {
      const params = {
        ticketId: 'ticket-789',
        tenantId: 'tenant-789',
        applicationId: 'app-789',
        eventType: 'ticket_resolved',
        data: {},
      };

      const preferences = [
        {
          id: 'pref-1',
          applicationId: 'app-789',
          tenantId: 'tenant-789',
          channel: 'email',
          events: ['ticket_created'], // does not include ticket_resolved
          enabled: true,
          config: {},
        },
      ];

      mockPrismaService.notificationPreference.findMany.mockResolvedValue(preferences);

      await service.dispatchNotification(params);

      expect(queue.add).not.toHaveBeenCalled();
      expect(prisma.notificationLog.create).not.toHaveBeenCalled();
    });

    it('should dispatch when preference has empty events array (all events)', async () => {
      const params = {
        ticketId: 'ticket-999',
        tenantId: 'tenant-999',
        applicationId: 'app-999',
        eventType: 'ticket_any_event',
        data: {},
      };

      const preferences = [
        {
          id: 'pref-1',
          applicationId: 'app-999',
          tenantId: 'tenant-999',
          channel: 'slack',
          events: [], // empty = match all events
          enabled: true,
          config: {},
        },
      ];

      mockPrismaService.notificationPreference.findMany.mockResolvedValue(preferences);

      await service.dispatchNotification(params);

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
    });

    it('should create notification log entry with pending status', async () => {
      const params = {
        ticketId: 'ticket-log',
        tenantId: 'tenant-log',
        applicationId: 'app-log',
        eventType: 'ticket_created',
        data: { test: 'data' },
      };

      const preferences = [
        {
          id: 'pref-log',
          applicationId: 'app-log',
          tenantId: 'tenant-log',
          channel: 'email',
          events: ['ticket_created'],
          enabled: true,
          config: {},
        },
      ];

      mockPrismaService.notificationPreference.findMany.mockResolvedValue(preferences);

      await service.dispatchNotification(params);

      expect(prisma.notificationLog.create).toHaveBeenCalledWith({
        data: {
          ticketId: 'ticket-log',
          tenantId: 'tenant-log',
          channel: 'email',
          eventType: 'ticket_created',
          status: 'pending',
          metadata: { test: 'data' },
        },
      });
    });
  });
});
