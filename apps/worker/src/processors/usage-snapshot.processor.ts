import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';

/**
 * UsageSnapshotProcessor
 *
 * Scheduled job that runs at the start of each month to:
 * 1. Snapshot current usage metrics into LicenseUsage table
 * 2. Clean up usage data older than 12 months
 *
 * This processor is triggered by a repeatable job added to the 'usage-snapshot' queue.
 */
@Processor('usage-snapshot')
export class UsageSnapshotProcessor extends WorkerHost {
  private readonly logger = new Logger(UsageSnapshotProcessor.name);
  private readonly prisma: PrismaClient;

  constructor() {
    super();
    this.prisma = new PrismaClient();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Starting monthly usage snapshot...');

    try {
      // Get all tenants
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });

      const currentMonth = this.getCurrentMonth();

      for (const tenant of tenants) {
        const usage = await this.getCurrentUsage(tenant.id);

        // Snapshot each metric
        const metrics = [
          { name: 'tickets', value: usage.tickets },
          { name: 'agent_tasks', value: usage.agent_tasks },
          { name: 'users', value: usage.users },
          { name: 'repositories', value: usage.repositories },
        ];

        for (const metric of metrics) {
          await this.prisma.licenseUsage.upsert({
            where: {
              tenantId_month_metric: {
                tenantId: tenant.id,
                month: currentMonth,
                metric: metric.name,
              },
            },
            create: {
              tenantId: tenant.id,
              month: currentMonth,
              metric: metric.name,
              count: metric.value,
            },
            update: {
              count: metric.value,
            },
          });
        }

        this.logger.log(
          `Snapshot completed for tenant ${tenant.id}: ${JSON.stringify(usage)}`,
        );
      }

      // Clean up old usage data (older than 12 months)
      const now = new Date();
      const twelveMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 12,
        1,
      );
      const year = twelveMonthsAgo.getFullYear();
      const month = String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0');
      const cutoffMonth = `${year}-${month}`;

      const deleted = await this.prisma.licenseUsage.deleteMany({
        where: {
          month: {
            lt: cutoffMonth,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${deleted.count} old usage records before ${cutoffMonth}`,
      );
      this.logger.log('Monthly usage snapshot completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to snapshot monthly usage: ${errorMessage}`);
      throw error;
    }
  }

  private async getCurrentUsage(tenantId: string): Promise<{
    tickets: number;
    agent_tasks: number;
    users: number;
    repositories: number;
  }> {
    const currentMonth = this.getCurrentMonth();
    const [yearStr, monthStr] = currentMonth.split('-');
    const startOfMonth = new Date(
      parseInt(yearStr || '2026'),
      parseInt(monthStr || '1') - 1,
      1,
    );

    // Get ticket count for current month
    const ticketsCount = await this.prisma.ticket.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Get agent tasks count for current month
    const agentTasksCount = await this.prisma.agentTask.count({
      where: {
        tenantId,
        startedAt: {
          gte: startOfMonth,
        },
      },
    });

    // Get active users count (total users, not monthly)
    const usersCount = await this.prisma.user.count({
      where: {
        tenantId,
      },
    });

    // Get connected repositories count
    const reposCount = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT jsonb_array_elements(repos)->>'id') as count
      FROM github_connections
      WHERE tenant_id = ${tenantId}::uuid
    `;

    const repositoriesCount =
      reposCount.length > 0 && reposCount[0]
        ? Number(reposCount[0].count)
        : 0;

    return {
      tickets: ticketsCount,
      agent_tasks: agentTasksCount,
      users: usersCount,
      repositories: repositoriesCount,
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
