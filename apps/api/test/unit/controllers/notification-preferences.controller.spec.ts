import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationPreferencesController } from '../../../src/modules/notifications/notification-preferences.controller';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let prisma: PrismaService;

  const mockPrismaService = {
    notificationPreference: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    application: {
      findFirst: jest.fn(),
    },
  };

  const tenantId = 'tenant-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<NotificationPreferencesController>(NotificationPreferencesController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all preferences for tenant', async () => {
      const preferences = [
        {
          id: 'pref-1',
          tenantId,
          applicationId: 'app-1',
          channel: 'email',
          events: ['ticket_created'],
          enabled: true,
        },
        {
          id: 'pref-2',
          tenantId,
          applicationId: 'app-2',
          channel: 'slack',
          events: [],
          enabled: true,
        },
      ];

      mockPrismaService.notificationPreference.findMany.mockResolvedValue(preferences);

      const result = await controller.findAll(tenantId);

      expect(result).toEqual(preferences);
      expect(prisma.notificationPreference.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create notification preference for valid application', async () => {
      const dto = {
        applicationId: 'app-123',
        channel: 'email',
        events: ['ticket_created', 'ticket_updated'],
        config: { recipients: ['admin@example.com'] },
        enabled: true,
      };
      const app = { id: 'app-123', tenantId };
      const preference = {
        id: 'pref-123',
        ...dto,
        tenantId,
      };

      mockPrismaService.application.findFirst.mockResolvedValue(app);
      mockPrismaService.notificationPreference.create.mockResolvedValue(preference);

      const result = await controller.create(tenantId, dto);

      expect(result).toEqual(preference);
      expect(prisma.application.findFirst).toHaveBeenCalledWith({
        where: { id: 'app-123', tenantId },
      });
      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'app-123',
          tenantId,
          channel: 'email',
          events: ['ticket_created', 'ticket_updated'],
        }),
      });
    });

    it('should use default empty events array when not provided', async () => {
      const dto = {
        applicationId: 'app-456',
        channel: 'slack',
        config: { webhook: 'https://hooks.slack.com/xxx' },
      };
      const app = { id: 'app-456', tenantId };
      const preference = { id: 'pref-456', ...dto, tenantId, events: [] };

      mockPrismaService.application.findFirst.mockResolvedValue(app);
      mockPrismaService.notificationPreference.create.mockResolvedValue(preference);

      await controller.create(tenantId, dto);

      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          events: [],
        }),
      });
    });

    it('should use default enabled=true when not provided', async () => {
      const dto = {
        applicationId: 'app-789',
        channel: 'email',
      };
      const app = { id: 'app-789', tenantId };
      const preference = { id: 'pref-789', ...dto, tenantId, events: [], enabled: true };

      mockPrismaService.application.findFirst.mockResolvedValue(app);
      mockPrismaService.notificationPreference.create.mockResolvedValue(preference);

      await controller.create(tenantId, dto);

      expect(prisma.notificationPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          enabled: true,
        }),
      });
    });

    it('should throw NotFoundException when application not found', async () => {
      const dto = {
        applicationId: 'non-existent',
        channel: 'email',
      };

      mockPrismaService.application.findFirst.mockResolvedValue(null);

      await expect(controller.create(tenantId, dto)).rejects.toThrow(NotFoundException);
      await expect(controller.create(tenantId, dto)).rejects.toThrow('Application non-existent not found');
    });

    it('should throw NotFoundException when application belongs to different tenant', async () => {
      const dto = {
        applicationId: 'app-other',
        channel: 'email',
      };

      mockPrismaService.application.findFirst.mockResolvedValue(null);

      await expect(controller.create(tenantId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update notification preference', async () => {
      const prefId = 'pref-123';
      const existing = {
        id: prefId,
        tenantId,
        channel: 'email',
      };
      const dto = {
        events: ['ticket_resolved'],
        enabled: false,
      };
      const updated = {
        ...existing,
        ...dto,
      };

      mockPrismaService.notificationPreference.findFirst.mockResolvedValue(existing);
      mockPrismaService.notificationPreference.update.mockResolvedValue(updated);

      const result = await controller.update(tenantId, prefId, dto);

      expect(result).toEqual(updated);
      expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
        where: { id: prefId },
        data: expect.objectContaining({
          events: ['ticket_resolved'],
          enabled: false,
        }),
      });
    });

    it('should update only provided fields', async () => {
      const prefId = 'pref-456';
      const existing = { id: prefId, tenantId };
      const dto = { enabled: true };

      mockPrismaService.notificationPreference.findFirst.mockResolvedValue(existing);
      mockPrismaService.notificationPreference.update.mockResolvedValue(existing);

      await controller.update(tenantId, prefId, dto);

      expect(prisma.notificationPreference.update).toHaveBeenCalledWith({
        where: { id: prefId },
        data: { enabled: true },
      });
    });

    it('should throw NotFoundException when preference not found', async () => {
      mockPrismaService.notificationPreference.findFirst.mockResolvedValue(null);

      await expect(controller.update(tenantId, 'not-found', {})).rejects.toThrow(NotFoundException);
      await expect(controller.update(tenantId, 'not-found', {})).rejects.toThrow(
        'Notification preference not-found not found',
      );
    });
  });

  describe('remove', () => {
    it('should delete notification preference', async () => {
      const prefId = 'pref-123';
      const existing = { id: prefId, tenantId };

      mockPrismaService.notificationPreference.findFirst.mockResolvedValue(existing);

      const result = await controller.remove(tenantId, prefId);

      expect(result).toEqual({ deleted: true });
      expect(prisma.notificationPreference.delete).toHaveBeenCalledWith({
        where: { id: prefId },
      });
    });

    it('should throw NotFoundException when preference not found', async () => {
      mockPrismaService.notificationPreference.findFirst.mockResolvedValue(null);

      await expect(controller.remove(tenantId, 'not-found')).rejects.toThrow(NotFoundException);
    });
  });
});
