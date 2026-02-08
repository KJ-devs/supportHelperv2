import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsCryptoService } from './integrations-crypto.service';
import { INTEGRATION_PROVIDERS } from './providers';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: IntegrationsCryptoService,
  ) {}

  async create(tenantId: string, dto: CreateIntegrationDto) {
    const Provider = INTEGRATION_PROVIDERS[dto.type as keyof typeof INTEGRATION_PROVIDERS];
    if (!Provider) {
      throw new BadRequestException(`Unknown integration type: ${dto.type}`);
    }

    const provider = new Provider();

    const validation = await provider.validateConfig(dto.config);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid configuration: ${validation.errors?.join(', ')}`);
    }

    const existing = await this.prisma.integration.findUnique({
      where: {
        tenantId_type_name: {
          tenantId,
          type: dto.type,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Integration with type "${dto.type}" and name "${dto.name}" already exists`);
    }

    const { ciphertext, iv } = this.cryptoService.encrypt(JSON.stringify(dto.config));

    const integration = await this.prisma.integration.create({
      data: {
        tenantId,
        type: dto.type,
        name: dto.name,
        enabled: dto.enabled ?? true,
        config: ciphertext,
        configIv: iv,
        mappings: dto.mappings || {},
      },
      include: {
        _count: {
          select: { syncLogs: true },
        },
      },
    });

    this.logger.log(`Created ${dto.type} integration "${dto.name}" for tenant ${tenantId}`);

    return this.decryptIntegration(integration);
  }

  async findAll(tenantId: string, filters?: { type?: string; enabled?: boolean }) {
    const integrations = await this.prisma.integration.findMany({
      where: {
        tenantId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
      },
      include: {
        _count: {
          select: { syncLogs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((integration) => this.decryptIntegration(integration));
  }

  async findOne(id: string, tenantId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { syncLogs: true },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return this.decryptIntegration(integration);
  }

  async update(id: string, tenantId: string, dto: UpdateIntegrationDto) {
    const existing = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Integration not found');
    }

    let ciphertext = existing.config;
    let iv = existing.configIv;

    if (dto.config) {
      const Provider = INTEGRATION_PROVIDERS[existing.type as keyof typeof INTEGRATION_PROVIDERS];
      if (!Provider) {
        throw new BadRequestException(`Unknown integration type: ${existing.type}`);
      }

      const provider = new Provider();
      const validation = await provider.validateConfig(dto.config);
      if (!validation.valid) {
        throw new BadRequestException(`Invalid configuration: ${validation.errors?.join(', ')}`);
      }

      const encrypted = this.cryptoService.encrypt(JSON.stringify(dto.config));
      ciphertext = encrypted.ciphertext;
      iv = encrypted.iv;
    }

    const integration = await this.prisma.integration.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.config && { config: ciphertext, configIv: iv }),
        ...(dto.mappings && { mappings: dto.mappings }),
      },
      include: {
        _count: {
          select: { syncLogs: true },
        },
      },
    });

    this.logger.log(`Updated integration ${id} for tenant ${tenantId}`);

    return this.decryptIntegration(integration);
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Integration not found');
    }

    await this.prisma.integration.delete({ where: { id } });

    this.logger.log(`Deleted integration ${id} for tenant ${tenantId}`);
  }

  async testConnection(id: string, tenantId: string) {
    const integration = await this.findOne(id, tenantId);

    const Provider = INTEGRATION_PROVIDERS[integration.type as keyof typeof INTEGRATION_PROVIDERS];
    if (!Provider) {
      throw new BadRequestException(`Unknown integration type: ${integration.type}`);
    }

    const provider = new Provider();
    const result = await provider.testConnection(integration.config);

    this.logger.log(`Connection test for integration ${id}: ${result.success ? 'success' : 'failed'}`);

    return result;
  }

  async getAvailableTypes() {
    return Object.keys(INTEGRATION_PROVIDERS).map((type) => {
      const Provider = INTEGRATION_PROVIDERS[type as keyof typeof INTEGRATION_PROVIDERS];
      const provider = new Provider();

      return {
        type: provider.type,
        name: provider.name,
        description: provider.description,
        requiredConfig: provider.requiredConfig,
        optionalConfig: provider.optionalConfig,
        supportsOAuth: provider.supportsOAuth,
      };
    });
  }

  async getSyncLogs(integrationId: string, tenantId: string, page = 0, limit = 20) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, tenantId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const [logs, total] = await Promise.all([
      this.prisma.integrationSyncLog.findMany({
        where: { integrationId },
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { syncedAt: 'desc' },
        skip: page * limit,
        take: limit,
      }),
      this.prisma.integrationSyncLog.count({ where: { integrationId } }),
    ]);

    return { data: logs, total, page, limit };
  }

  private decryptIntegration(integration: any) {
    try {
      const decryptedConfig = JSON.parse(this.cryptoService.decrypt(integration.config, integration.configIv));

      return {
        ...integration,
        config: decryptedConfig,
        configIv: undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to decrypt integration ${integration.id}: ${error.message}`);
      return {
        ...integration,
        config: {},
        configIv: undefined,
      };
    }
  }
}
