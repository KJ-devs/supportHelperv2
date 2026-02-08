import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateSlug } from '@support-helper/shared';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; slug?: string }) {
    let slug = data.slug || generateSlug(data.name);

    // Ensure slug is unique
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      // Append random suffix
      slug = `${slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        plan: 'free',
        settings: {},
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, data: { name?: string; settings?: Record<string, unknown> }) {
    const tenant = await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: data.name,
        settings: data.settings ? (data.settings as Prisma.InputJsonValue) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async updatePlan(id: string, plan: string) {
    const tenant = await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan },
    });
  }

  async getStats(id: string) {
    const tenant = await this.findOne(id);

    const [usersCount, appsCount, ticketsCount, openTicketsCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id } }),
      this.prisma.application.count({ where: { tenantId: id } }),
      this.prisma.ticket.count({ where: { tenantId: id } }),
      this.prisma.ticket.count({
        where: {
          tenantId: id,
          status: { in: ['new', 'open', 'in_progress', 'analyzing'] },
        },
      }),
    ]);

    return {
      tenant,
      stats: {
        users: usersCount,
        applications: appsCount,
        tickets: ticketsCount,
        openTickets: openTicketsCount,
      },
    };
  }
}
