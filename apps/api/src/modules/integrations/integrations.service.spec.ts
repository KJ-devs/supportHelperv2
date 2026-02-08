import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsCryptoService } from './integrations-crypto.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: PrismaService;
  let crypto: IntegrationsCryptoService;

  const mockPrisma = {
    integration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    integrationSyncLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCrypto = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IntegrationsCryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<IntegrationsCryptoService>(IntegrationsCryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create integration with encrypted config', async () => {
      const tenantId = 'tenant-123';
      const dto = {
        type: 'slack',
        name: 'My Slack',
        enabled: true,
        config: { botToken: 'xoxb-test', channel: '#general' },
      };

      mockCrypto.encrypt.mockReturnValue({
        ciphertext: 'encrypted-config',
        iv: 'test-iv',
      });

      mockPrisma.integration.findUnique.mockResolvedValue(null);
      mockPrisma.integration.create.mockResolvedValue({
        id: 'int-123',
        tenantId,
        ...dto,
        config: 'encrypted-config',
        configIv: 'test-iv',
        _count: { syncLogs: 0 },
      });

      mockCrypto.decrypt.mockReturnValue(JSON.stringify(dto.config));

      const result = await service.create(tenantId, dto);

      expect(mockCrypto.encrypt).toHaveBeenCalledWith(JSON.stringify(dto.config));
      expect(mockPrisma.integration.create).toHaveBeenCalled();
      expect(result.config).toEqual(dto.config);
    });

    it('should throw ConflictException if integration exists', async () => {
      const tenantId = 'tenant-123';
      const dto = {
        type: 'slack',
        name: 'My Slack',
        enabled: true,
        config: {},
      };

      mockPrisma.integration.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(tenantId, dto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid type', async () => {
      const tenantId = 'tenant-123';
      const dto = {
        type: 'invalid-type',
        name: 'Test',
        enabled: true,
        config: {},
      };

      await expect(service.create(tenantId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return decrypted integrations for tenant', async () => {
      const tenantId = 'tenant-123';

      mockPrisma.integration.findMany.mockResolvedValue([
        {
          id: 'int-1',
          tenantId,
          type: 'slack',
          config: 'encrypted-1',
          configIv: 'iv-1',
          _count: { syncLogs: 5 },
        },
      ]);

      mockCrypto.decrypt.mockReturnValue(JSON.stringify({ botToken: 'test' }));

      const result = await service.findAll(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].config).toEqual({ botToken: 'test' });
      expect(mockCrypto.decrypt).toHaveBeenCalledWith('encrypted-1', 'iv-1');
    });

    it('should filter by type', async () => {
      const tenantId = 'tenant-123';
      mockPrisma.integration.findMany.mockResolvedValue([]);

      await service.findAll(tenantId, { type: 'slack' });

      expect(mockPrisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'slack' }),
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return decrypted integration', async () => {
      const tenantId = 'tenant-123';
      const id = 'int-123';

      mockPrisma.integration.findFirst.mockResolvedValue({
        id,
        tenantId,
        config: 'encrypted',
        configIv: 'iv',
      });

      mockCrypto.decrypt.mockReturnValue(JSON.stringify({ key: 'value' }));

      const result = await service.findOne(id, tenantId);

      expect(result.config).toEqual({ key: 'value' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue(null);

      await expect(service.findOne('int-123', 'tenant-123')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('should update integration with new encrypted config', async () => {
      const tenantId = 'tenant-123';
      const id = 'int-123';

      mockPrisma.integration.findFirst.mockResolvedValue({
        id,
        tenantId,
        type: 'slack',
        config: 'old-encrypted',
        configIv: 'old-iv',
      });

      mockCrypto.encrypt.mockReturnValue({
        ciphertext: 'new-encrypted',
        iv: 'new-iv',
      });

      mockPrisma.integration.update.mockResolvedValue({
        id,
        config: 'new-encrypted',
        configIv: 'new-iv',
      });

      mockCrypto.decrypt.mockReturnValue(JSON.stringify({ newKey: 'newValue' }));

      const result = await service.update(id, tenantId, {
        config: { newKey: 'newValue' },
      });

      expect(mockPrisma.integration.update).toHaveBeenCalled();
      expect(result.config).toEqual({ newKey: 'newValue' });
    });
  });

  describe('delete', () => {
    it('should delete integration', async () => {
      const tenantId = 'tenant-123';
      const id = 'int-123';

      mockPrisma.integration.findFirst.mockResolvedValue({ id, tenantId });
      mockPrisma.integration.delete.mockResolvedValue({ id });

      await service.delete(id, tenantId);

      expect(mockPrisma.integration.delete).toHaveBeenCalledWith({ where: { id } });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.integration.findFirst.mockResolvedValue(null);

      await expect(service.delete('int-123', 'tenant-123')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('tenant isolation', () => {
    it('should not return integrations from other tenants', async () => {
      mockPrisma.integration.findMany.mockResolvedValue([]);

      await service.findAll('tenant-123');

      expect(mockPrisma.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-123' }),
        })
      );
    });
  });
});
