import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CacheKeys, CacheTTL } from '../cache';
import { generateSDKKey } from '@support-helper/shared';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(tenantId: string, data: { name: string; platform?: string; githubRepo?: string; settings?: Record<string, unknown> }) {
    const sdkKey = generateSDKKey();

    const app = await this.prisma.application.create({
      data: {
        tenantId,
        name: data.name,
        platform: data.platform,
        githubRepo: data.githubRepo,
        sdkKey,
        settings: (data.settings || {}) as Prisma.InputJsonValue,
      },
    });

    await this.invalidateAppCaches(tenantId);
    return app;
  }

  async findByTenant(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.applicationList(tenantId),
      CacheTTL.APPLICATIONS,
      () => this.prisma.application.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(id: string, tenantId: string) {
    const cacheKey = CacheKeys.applicationDetail(tenantId, id);
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const app = await this.prisma.application.findFirst({
      where: { id, tenantId },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    await this.cacheService.set(cacheKey, app, CacheTTL.APPLICATIONS);
    return app;
  }

  async update(id: string, tenantId: string, data: { name?: string; platform?: string; githubRepo?: string; settings?: Record<string, unknown> }) {
    const app = await this.findOne(id, tenantId);

    const updated = await this.prisma.application.update({
      where: { id: app.id },
      data: {
        ...data,
        settings: data.settings ? (data.settings as Prisma.InputJsonValue) : undefined,
      },
    });

    await this.invalidateAppCaches(tenantId, id);
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const app = await this.findOne(id, tenantId);
    await this.prisma.application.delete({ where: { id: app.id } });
    await this.invalidateAppCaches(tenantId, id);
    return { success: true };
  }

  async regenerateSdkKey(id: string, tenantId: string) {
    const app = await this.findOne(id, tenantId);

    const updated = await this.prisma.application.update({
      where: { id: app.id },
      data: { sdkKey: generateSDKKey() },
    });

    await this.invalidateAppCaches(tenantId, id);
    return updated;
  }

  async getStats(id: string, tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.applicationStats(tenantId, id),
      CacheTTL.APPLICATIONS,
      async () => {
        const app = await this.findOne(id, tenantId);

        const [totalTickets, openTickets, resolvedTickets] = await Promise.all([
          this.prisma.ticket.count({ where: { applicationId: id, tenantId } }),
          this.prisma.ticket.count({
            where: {
              applicationId: id,
              tenantId,
              status: { in: ['new', 'open', 'in_progress'] },
            },
          }),
          this.prisma.ticket.count({
            where: {
              applicationId: id,
              tenantId,
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
      },
    );
  }

  private async invalidateAppCaches(tenantId: string, appId?: string): Promise<void> {
    const promises: Promise<void>[] = [
      this.cacheService.del(CacheKeys.applicationList(tenantId)),
    ];
    if (appId) {
      promises.push(
        this.cacheService.del(CacheKeys.applicationDetail(tenantId, appId)),
        this.cacheService.del(CacheKeys.applicationStats(tenantId, appId)),
      );
    }
    await Promise.all(promises);
  }
}
