import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateSDKKey } from '@support-helper/shared';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: { name: string; platform?: string; githubRepo?: string; settings?: Record<string, unknown> }) {
    const sdkKey = generateSDKKey();

    return this.prisma.application.create({
      data: {
        tenantId,
        name: data.name,
        platform: data.platform,
        githubRepo: data.githubRepo,
        sdkKey,
        settings: (data.settings || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findByTenant(tenantId: string) {
    return this.prisma.application.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const app = await this.prisma.application.findFirst({
      where: { id, tenantId },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    return app;
  }

  async update(id: string, tenantId: string, data: { name?: string; platform?: string; githubRepo?: string; settings?: Record<string, unknown> }) {
    const app = await this.findOne(id, tenantId);

    return this.prisma.application.update({
      where: { id: app.id },
      data: {
        ...data,
        settings: data.settings ? (data.settings as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const app = await this.findOne(id, tenantId);
    await this.prisma.application.delete({ where: { id: app.id } });
    return { success: true };
  }

  async regenerateSdkKey(id: string, tenantId: string) {
    const app = await this.findOne(id, tenantId);

    return this.prisma.application.update({
      where: { id: app.id },
      data: { sdkKey: generateSDKKey() },
    });
  }

  async getStats(id: string, tenantId: string) {
    const app = await this.findOne(id, tenantId);

    const [totalTickets, openTickets, resolvedTickets] = await Promise.all([
      this.prisma.ticket.count({ where: { applicationId: id } }),
      this.prisma.ticket.count({
        where: {
          applicationId: id,
          status: { in: ['new', 'open', 'in_progress'] },
        },
      }),
      this.prisma.ticket.count({
        where: {
          applicationId: id,
          status: { in: ['resolved', 'closed'] },
        },
      }),
    ]);

    return {
      application: app,
      stats: {
        totalTickets,
        openTickets,
        resolvedTickets,
      },
    };
  }
}
