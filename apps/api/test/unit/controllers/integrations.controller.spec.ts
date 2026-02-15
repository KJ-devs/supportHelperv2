import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from '../../../src/modules/integrations/integrations.controller';
import { IntegrationsService } from '../../../src/modules/integrations/integrations.service';
import { IntegrationsSyncService } from '../../../src/modules/integrations/integrations-sync.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  let integrationsService: jest.Mocked<IntegrationsService>;
  let syncService: jest.Mocked<IntegrationsSyncService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockIntegration = {
    id: 'int-123',
    tenantId: 'tenant-123',
    type: 'jira',
    name: 'Jira Cloud',
    enabled: true,
    config: {},
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            getAvailableTypes: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            testConnection: jest.fn(),
            getSyncLogs: jest.fn(),
            getSyncStats: jest.fn(),
          },
        },
        {
          provide: IntegrationsSyncService,
          useValue: {
            syncTicketToIntegration: jest.fn(),
            pullTicketsFromIntegration: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            ticket: { findMany: jest.fn() },
            integrationSyncLog: { findMany: jest.fn() },
            application: { findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
    integrationsService = module.get(IntegrationsService);
    syncService = module.get(IntegrationsSyncService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create integration', async () => {
      (integrationsService.create as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await controller.create('tenant-123', { type: 'jira', name: 'Jira' } as any);

      expect(integrationsService.create).toHaveBeenCalledWith('tenant-123', { type: 'jira', name: 'Jira' });
      expect(result).toEqual(mockIntegration);
    });
  });

  describe('findAll', () => {
    it('should return all integrations', async () => {
      (integrationsService.findAll as jest.Mock).mockResolvedValue([mockIntegration]);

      const result = await controller.findAll('tenant-123');

      expect(integrationsService.findAll).toHaveBeenCalledWith('tenant-123', { type: undefined, enabled: undefined });
      expect(result).toHaveLength(1);
    });

    it('should filter by type and enabled', async () => {
      (integrationsService.findAll as jest.Mock).mockResolvedValue([]);

      await controller.findAll('tenant-123', 'jira', 'true');

      expect(integrationsService.findAll).toHaveBeenCalledWith('tenant-123', { type: 'jira', enabled: true });
    });
  });

  describe('getTypes', () => {
    it('should return available types', async () => {
      const types = [{ type: 'jira', name: 'Jira' }, { type: 'slack', name: 'Slack' }];
      (integrationsService.getAvailableTypes as jest.Mock).mockResolvedValue(types);

      const result = await controller.getTypes();

      expect(result).toEqual(types);
    });
  });

  describe('findOne', () => {
    it('should return integration by id', async () => {
      (integrationsService.findOne as jest.Mock).mockResolvedValue(mockIntegration);

      const result = await controller.findOne('int-123', 'tenant-123');

      expect(integrationsService.findOne).toHaveBeenCalledWith('int-123', 'tenant-123');
      expect(result).toEqual(mockIntegration);
    });
  });

  describe('update', () => {
    it('should update integration', async () => {
      (integrationsService.update as jest.Mock).mockResolvedValue({ ...mockIntegration, name: 'Updated' });

      const result = await controller.update('int-123', 'tenant-123', { name: 'Updated' } as any);

      expect(integrationsService.update).toHaveBeenCalledWith('int-123', 'tenant-123', { name: 'Updated' });
    });
  });

  describe('delete', () => {
    it('should delete integration', async () => {
      (integrationsService.delete as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.delete('int-123', 'tenant-123');

      expect(integrationsService.delete).toHaveBeenCalledWith('int-123', 'tenant-123');
      expect(result).toEqual({ success: true });
    });
  });

  describe('testConnection', () => {
    it('should test integration connection', async () => {
      const testResult = { success: true, message: 'Connected' };
      (integrationsService.testConnection as jest.Mock).mockResolvedValue(testResult);

      const result = await controller.testConnection('int-123', 'tenant-123');

      expect(result).toEqual(testResult);
    });
  });

  describe('getSyncLogs', () => {
    it('should return sync logs', async () => {
      const logs = { items: [], total: 0 };
      (integrationsService.getSyncLogs as jest.Mock).mockResolvedValue(logs);

      const result = await controller.getSyncLogs('int-123', 'tenant-123');

      expect(integrationsService.getSyncLogs).toHaveBeenCalledWith('int-123', 'tenant-123', expect.any(Object));
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      const stats = { total: 100, success: 95, failed: 5 };
      (integrationsService.getSyncStats as jest.Mock).mockResolvedValue(stats);

      const result = await controller.getSyncStats('int-123', 'tenant-123');

      expect(result).toEqual(stats);
    });
  });
});
