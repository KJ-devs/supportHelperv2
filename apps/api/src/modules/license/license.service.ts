import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { LICENSE_PUBLIC_KEY } from './keys/public.key';
import {
  LicensePayload,
  PlanLimits,
  PlanType,
  FREE_PLAN_LIMITS,
} from './license.types';

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private license: LicensePayload | null = null;
  private isValid = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadLicense();
  }

  private async loadLicense(): Promise<void> {
    try {
      // Try to load license from env var first
      let licenseKey = this.config.get<string>('LICENSE_KEY');

      // Fall back to system_config if not in env
      if (!licenseKey) {
        const systemConfig = await this.prisma.systemConfig.findUnique({
          where: { key: 'license_key' },
        });
        if (
          systemConfig?.value &&
          typeof systemConfig.value === 'object' &&
          'licenseKey' in systemConfig.value
        ) {
          licenseKey = systemConfig.value.licenseKey as string;
        }
      }

      if (!licenseKey) {
        this.logger.warn('No license key found - running in FREE mode');
        this.license = null;
        this.isValid = false;
        return;
      }

      // Verify JWT with RSA public key
      const decoded = jwt.verify(licenseKey, LICENSE_PUBLIC_KEY, {
        algorithms: ['RS256'],
      }) as LicensePayload;

      // Check if expired
      const expiresAt = new Date(decoded.expiresAt);
      if (expiresAt < new Date()) {
        this.logger.warn('License has expired - running in FREE mode');
        this.license = null;
        this.isValid = false;
        return;
      }

      this.license = decoded;
      this.isValid = true;
      this.logger.log(
        `License loaded successfully - Plan: ${decoded.plan}, Tenant: ${decoded.tenantName}, Expires: ${decoded.expiresAt}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load/verify license: ${error.message} - running in FREE mode`,
      );
      this.license = null;
      this.isValid = false;
    }
  }

  getLicense(): LicensePayload | null {
    return this.license;
  }

  getPlan(): PlanType {
    return this.license?.plan || 'free';
  }

  getPlanLimits(): PlanLimits {
    if (!this.license || !this.isValid) {
      return FREE_PLAN_LIMITS;
    }

    return {
      maxTicketsPerMonth: this.license.maxTicketsPerMonth,
      maxAgentTasksPerMonth: this.license.maxAgentTasksPerMonth,
      maxRepos: this.license.maxRepos,
      maxUsers: this.license.maxUsers,
      features: this.license.features,
    };
  }

  isFeatureEnabled(feature: string): boolean {
    const limits = this.getPlanLimits();
    return limits.features.includes(feature);
  }

  async checkUsageLimit(
    tenantId: string,
    metric: string,
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = this.getPlanLimits();
    const currentMonth = this.getCurrentMonth();

    // Get current usage for this month
    const usage = await this.prisma.licenseUsage.findUnique({
      where: {
        tenantId_month_metric: {
          tenantId,
          month: currentMonth,
          metric,
        },
      },
    });

    const current = usage?.count || 0;
    let limit = 0;

    // Map metric to limit
    switch (metric) {
      case 'tickets':
        limit = limits.maxTicketsPerMonth;
        break;
      case 'agent_tasks':
        limit = limits.maxAgentTasksPerMonth;
        break;
      case 'users':
        limit = limits.maxUsers;
        break;
      default:
        this.logger.warn(`Unknown metric: ${metric}`);
        return { allowed: true, current, limit: 0 };
    }

    return {
      allowed: current < limit,
      current,
      limit,
    };
  }

  async incrementUsage(tenantId: string, metric: string): Promise<void> {
    const currentMonth = this.getCurrentMonth();

    await this.prisma.licenseUsage.upsert({
      where: {
        tenantId_month_metric: {
          tenantId,
          month: currentMonth,
          metric,
        },
      },
      create: {
        tenantId,
        month: currentMonth,
        metric,
        count: 1,
      },
      update: {
        count: {
          increment: 1,
        },
      },
    });
  }

  async getUsageSummary(
    tenantId: string,
  ): Promise<Record<string, { current: number; limit: number }>> {
    const currentMonth = this.getCurrentMonth();
    const limits = this.getPlanLimits();

    const usageRecords = await this.prisma.licenseUsage.findMany({
      where: {
        tenantId,
        month: currentMonth,
      },
    });

    const summary: Record<string, { current: number; limit: number }> = {
      tickets: {
        current: 0,
        limit: limits.maxTicketsPerMonth,
      },
      agent_tasks: {
        current: 0,
        limit: limits.maxAgentTasksPerMonth,
      },
      users: {
        current: 0,
        limit: limits.maxUsers,
      },
    };

    for (const record of usageRecords) {
      if (summary[record.metric]) {
        summary[record.metric].current = record.count;
      }
    }

    return summary;
  }

  async getLicenseInfo(): Promise<{
    plan: PlanType;
    limits: PlanLimits;
    usage: Record<string, { current: number; limit: number }>;
    expiresAt: string | null;
    valid: boolean;
  }> {
    const plan = this.getPlan();
    const limits = this.getPlanLimits();

    // Get usage for first tenant (for system license info)
    const firstTenant = await this.prisma.tenant.findFirst();
    const usage = firstTenant
      ? await this.getUsageSummary(firstTenant.id)
      : {
          tickets: { current: 0, limit: limits.maxTicketsPerMonth },
          agent_tasks: { current: 0, limit: limits.maxAgentTasksPerMonth },
          users: { current: 0, limit: limits.maxUsers },
        };

    return {
      plan,
      limits,
      usage,
      expiresAt: this.license?.expiresAt || null,
      valid: this.isValid,
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async getVersionInfo(): Promise<{
    current: string;
    dbVersion: string | null;
    dbCompatible: boolean;
    nodeVersion: string;
    uptime: number;
  }> {
    // Read version from package.json
    let current = '0.1.0';
    try {
      const packagePath = join(__dirname, '../../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      current = packageJson.version || '0.1.0';
    } catch (error) {
      this.logger.warn(`Failed to read package.json version: ${error.message}`);
    }

    // Get latest migration from _prisma_migrations table
    let dbVersion: string | null = null;
    let dbCompatible = true;
    try {
      const migrations = await this.prisma.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null }>
      >`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
        LIMIT 1
      `;

      if (migrations.length > 0) {
        dbVersion = migrations[0].migration_name;
      }

      // For now, we consider DB compatible if we have a migration
      // In the future, we could check against an expected migration name
      dbCompatible = dbVersion !== null;
    } catch (error) {
      this.logger.warn(`Failed to query migrations table: ${error.message}`);
      dbCompatible = false;
    }

    return {
      current,
      dbVersion,
      dbCompatible,
      nodeVersion: process.version,
      uptime: Math.floor(process.uptime()),
    };
  }

  async getLatestChangelog(): Promise<{
    version: string;
    date: string;
    changes: string[];
    dismissed: boolean;
  } | null> {
    try {
      const systemConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'latest_changelog' },
      });

      if (!systemConfig?.value || typeof systemConfig.value !== 'object') {
        return null;
      }

      const changelog = systemConfig.value as {
        version?: string;
        date?: string;
        changes?: string[];
      };

      return {
        version: changelog.version || '0.1.0',
        date: changelog.date || new Date().toISOString().split('T')[0],
        changes: changelog.changes || [],
        dismissed: false, // Will be user-specific in the controller if needed
      };
    } catch (error) {
      this.logger.error(`Failed to get changelog: ${error.message}`);
      return null;
    }
  }

  async dismissChangelogForUser(userId: string): Promise<void> {
    const key = `changelog_dismissed_${userId}`;
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: { dismissed: true, timestamp: new Date().toISOString() },
      },
      update: {
        value: { dismissed: true, timestamp: new Date().toISOString() },
      },
    });
  }

  async getCurrentUsage(tenantId: string): Promise<{
    tickets: number;
    agent_tasks: number;
    users: number;
    repositories: number;
  }> {
    const currentMonth = this.getCurrentMonth();
    const startOfMonth = new Date(
      parseInt(currentMonth.split('-')[0]),
      parseInt(currentMonth.split('-')[1]) - 1,
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
      reposCount.length > 0 ? Number(reposCount[0].count) : 0;

    return {
      tickets: ticketsCount,
      agent_tasks: agentTasksCount,
      users: usersCount,
      repositories: repositoriesCount,
    };
  }

  async getUsageAlerts(
    tenantId: string,
  ): Promise<
    Array<{ metric: string; percentage: number; message: string }>
  > {
    const currentUsage = await this.getCurrentUsage(tenantId);
    const limits = this.getPlanLimits();
    const alerts: Array<{ metric: string; percentage: number; message: string }> =
      [];

    const metricChecks = [
      {
        key: 'tickets' as const,
        limit: limits.maxTicketsPerMonth,
        label: 'Tickets',
      },
      {
        key: 'agent_tasks' as const,
        limit: limits.maxAgentTasksPerMonth,
        label: 'Agent tasks',
      },
      { key: 'users' as const, limit: limits.maxUsers, label: 'Users' },
      {
        key: 'repositories' as const,
        limit: limits.maxRepos,
        label: 'Repositories',
      },
    ];

    for (const check of metricChecks) {
      const current = currentUsage[check.key];
      if (check.limit > 0) {
        const percentage = Math.round((current / check.limit) * 100);
        if (percentage >= 80) {
          alerts.push({
            metric: check.key,
            percentage,
            message: `${check.label} usage at ${percentage}%`,
          });
        }
      }
    }

    return alerts;
  }

  async getUsageHistory(
    tenantId: string,
    months = 6,
  ): Promise<{
    months: string[];
    series: Array<{ metric: string; data: number[] }>;
  }> {
    const now = new Date();
    const monthList: string[] = [];

    // Generate list of last N months
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      monthList.push(`${year}-${month}`);
    }

    // Fetch usage data from LicenseUsage table
    const usageRecords = await this.prisma.licenseUsage.findMany({
      where: {
        tenantId,
        month: {
          in: monthList,
        },
      },
      orderBy: {
        month: 'asc',
      },
    });

    // Group by metric
    const metricMap = new Map<string, Map<string, number>>();

    for (const record of usageRecords) {
      if (!metricMap.has(record.metric)) {
        metricMap.set(record.metric, new Map());
      }
      metricMap.get(record.metric)!.set(record.month, record.count);
    }

    // Build series data
    const series: Array<{ metric: string; data: number[] }> = [];
    const metricsToTrack = ['tickets', 'agent_tasks', 'users', 'repositories'];

    for (const metric of metricsToTrack) {
      const dataMap = metricMap.get(metric);
      const data = monthList.map((month) => dataMap?.get(month) || 0);
      series.push({ metric, data });
    }

    return {
      months: monthList,
      series,
    };
  }

  async resetMonthlyCounters(): Promise<void> {
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

      await this.prisma.licenseUsage.deleteMany({
        where: {
          month: {
            lt: cutoffMonth,
          },
        },
      });

      this.logger.log('Monthly usage snapshot completed successfully');
    } catch (error) {
      this.logger.error(`Failed to snapshot monthly usage: ${error.message}`);
      throw error;
    }
  }
}
