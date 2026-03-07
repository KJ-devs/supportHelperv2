import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService, CacheKeys, CacheTTL } from '../../cache';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * Get dashboard overview statistics (cached for 1 hour)
   */
  async getOverview(tenantId: string, period: 'day' | 'week' | 'month' = 'week') {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsOverview(tenantId, period),
      CacheTTL.ANALYTICS,
      async () => {
        const startDate = this.getStartDate(period);

        const [
          totalTickets,
          newTickets,
          resolvedTickets,
          avgResolutionTime,
          ticketsByStatus,
          ticketsBySeverity,
          ticketsByType,
        ] = await Promise.all([
          this.getTotalTickets(tenantId),
          this.getNewTickets(tenantId, startDate),
          this.getResolvedTickets(tenantId, startDate),
          this.getAvgResolutionTime(tenantId, startDate),
          this.getTicketsByStatus(tenantId),
          this.getTicketsBySeverity(tenantId),
          this.getTicketsByType(tenantId),
        ]);

        return {
          totalTickets,
          newTickets,
          resolvedTickets,
          avgResolutionTime,
          ticketsByStatus,
          ticketsBySeverity,
          ticketsByType,
          period,
        };
      }
    );
  }

  /**
   * Get ticket trends over time (cached for 1 hour)
   */
  async getTrends(tenantId: string, period: 'day' | 'week' | 'month' = 'week', days: number = 30) {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsTrends(tenantId, period, days),
      CacheTTL.ANALYTICS,
      async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const tickets = await this.prisma.ticket.findMany({
          where: {
            tenantId,
            createdAt: { gte: startDate },
          },
          select: {
            createdAt: true,
            status: true,
          },
        });

        const trendData = this.groupByDate(tickets, period);

        return {
          period,
          days,
          data: trendData,
        };
      }
    );
  }

  /**
   * Get performance metrics (cached for 1 hour)
   */
  async getPerformanceMetrics(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsPerformance(tenantId),
      CacheTTL.ANALYTICS,
      async () => {
        const [firstResponseTime, resolutionRate, reopenRate, customerSatisfaction] =
          await Promise.all([
            this.getAvgFirstResponseTime(tenantId),
            this.getResolutionRate(tenantId),
            this.getReopenRate(tenantId),
            this.getCustomerSatisfaction(tenantId),
          ]);

        return {
          firstResponseTime,
          resolutionRate,
          reopenRate,
          customerSatisfaction,
        };
      }
    );
  }

  /**
   * Get agent performance statistics (cached for 1 hour)
   */
  async getAgentStats(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsAgentStats(tenantId),
      CacheTTL.ANALYTICS,
      () => this.getAgentStatsUncached(tenantId)
    );
  }

  private async getAgentStatsUncached(tenantId: string) {
    const agents = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: ['admin', 'agent'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const agentStats = await Promise.all(
      agents.map(async agent => {
        const [assigned, resolved, avgTime] = await Promise.all([
          this.prisma.ticket.count({
            where: {
              tenantId,
              assignedTo: agent.id,
            },
          }),
          this.prisma.ticket.count({
            where: {
              tenantId,
              assignedTo: agent.id,
              status: 'resolved',
            },
          }),
          this.getAvgResolutionTimeForAgent(tenantId, agent.id),
        ]);

        return {
          agent: {
            id: agent.id,
            name: agent.name,
            email: agent.email,
          },
          ticketsAssigned: assigned,
          ticketsResolved: resolved,
          avgResolutionTime: avgTime,
          resolutionRate: assigned > 0 ? (resolved / assigned) * 100 : 0,
        };
      })
    );

    return agentStats;
  }

  /**
   * Get application statistics (cached for 1 hour)
   */
  async getApplicationStats(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsAppStats(tenantId),
      CacheTTL.ANALYTICS,
      () => this.getApplicationStatsUncached(tenantId)
    );
  }

  private async getApplicationStatsUncached(tenantId: string) {
    const applications = await this.prisma.application.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    const appStats = await Promise.all(
      applications.map(async app => {
        const [resolved, critical] = await Promise.all([
          this.prisma.ticket.count({
            where: {
              applicationId: app.id,
              tenantId,
              status: 'resolved',
            },
          }),
          this.prisma.ticket.count({
            where: {
              applicationId: app.id,
              tenantId,
              severity: 'critical',
            },
          }),
        ]);

        return {
          application: {
            id: app.id,
            name: app.name,
            platform: app.platform,
          },
          totalTickets: app._count.tickets,
          resolvedTickets: resolved,
          criticalTickets: critical,
        };
      })
    );

    return appStats;
  }

  /**
   * Get monthly resolution trends for last 12 months (cached for 1 hour)
   */
  async getResolutionTrends(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsResolutionTrends(tenantId),
      CacheTTL.ANALYTICS,
      async () => {
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const tickets = await this.prisma.ticket.findMany({
          where: {
            tenantId,
            resolvedAt: { gte: twelveMonthsAgo, not: null },
          },
          select: {
            createdAt: true,
            resolvedAt: true,
          },
        });

        // Build buckets for each of the last 12 months
        const buckets = new Map<string, { resolved: number; totalHours: number }>();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          buckets.set(key, { resolved: 0, totalHours: 0 });
        }

        for (const ticket of tickets) {
          if (!ticket.resolvedAt) continue;
          const d = ticket.resolvedAt;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const bucket = buckets.get(key);
          if (!bucket) continue;
          bucket.resolved++;
          bucket.totalHours +=
            (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 1000 / 60 / 60;
        }

        const data = Array.from(buckets.entries()).map(([month, { resolved, totalHours }]) => ({
          month,
          resolved,
          avgResolutionTimeHours: resolved > 0 ? Math.round(totalHours / resolved) : 0,
        }));

        return { data };
      }
    );
  }

  /**
   * Get agent difficulty distribution (cached for 1 hour)
   */
  async getDifficulty(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.analyticsDifficulty(tenantId),
      CacheTTL.ANALYTICS,
      async () => {
        const [byN1Raw, crossTabRaw, resolvedTickets] = await Promise.all([
          this.prisma.ticket.groupBy({
            by: ['n1Decision'],
            where: { tenantId },
            _count: true,
          }),
          this.prisma.ticket.groupBy({
            by: ['severity', 'n1Decision'],
            where: { tenantId },
            _count: true,
          }),
          this.prisma.ticket.findMany({
            where: {
              tenantId,
              resolvedAt: { not: null },
              severity: { not: null },
            },
            select: {
              severity: true,
              createdAt: true,
              resolvedAt: true,
            },
          }),
        ]);

        // byN1Decision — map null to "not_triaged"
        const byN1Decision = byN1Raw.map(row => ({
          decision: row.n1Decision ?? 'not_triaged',
          count: row._count,
        }));

        // bySeverityAndDecision
        const bySeverityAndDecision = crossTabRaw.map(row => ({
          severity: row.severity ?? 'unknown',
          decision: row.n1Decision ?? 'not_triaged',
          count: row._count,
        }));

        // escalationRate: escalate_n2 / total triaged * 100
        const totalTriaged = byN1Raw
          .filter(r => r.n1Decision !== null)
          .reduce((sum, r) => sum + r._count, 0);
        const escalatedCount = byN1Raw.find(r => r.n1Decision === 'escalate_n2')?._count ?? 0;
        const escalationRate =
          totalTriaged > 0 ? Math.round((escalatedCount / totalTriaged) * 10000) / 100 : 0;

        // avgResolutionTimeBySeverity
        const severityBuckets = new Map<string, { total: number; count: number }>();
        for (const ticket of resolvedTickets) {
          if (!ticket.resolvedAt || !ticket.severity) continue;
          const hours = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 1000 / 60 / 60;
          const bucket = severityBuckets.get(ticket.severity) ?? { total: 0, count: 0 };
          bucket.total += hours;
          bucket.count++;
          severityBuckets.set(ticket.severity, bucket);
        }
        const avgResolutionTimeBySeverity = Array.from(severityBuckets.entries()).map(
          ([severity, { total, count }]) => ({
            severity,
            avgHours: count > 0 ? Math.round(total / count) : 0,
          })
        );

        return {
          byN1Decision,
          bySeverityAndDecision,
          escalationRate,
          avgResolutionTimeBySeverity,
        };
      }
    );
  }

  // Private helper methods

  private getTotalTickets(tenantId: string) {
    return this.prisma.ticket.count({ where: { tenantId } });
  }

  private getNewTickets(tenantId: string, startDate: Date) {
    return this.prisma.ticket.count({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
    });
  }

  private getResolvedTickets(tenantId: string, startDate: Date) {
    return this.prisma.ticket.count({
      where: {
        tenantId,
        status: 'resolved',
        resolvedAt: { gte: startDate },
      },
    });
  }

  private async getAvgResolutionTime(tenantId: string, startDate: Date) {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        status: 'resolved',
        resolvedAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalTime = tickets.reduce((sum, ticket) => {
      if (!ticket.resolvedAt) return sum;
      const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + diff;
    }, 0);

    // Return average in hours
    return Math.round(totalTime / tickets.length / 1000 / 60 / 60);
  }

  private async getAvgResolutionTimeForAgent(tenantId: string, agentId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        assignedTo: agentId,
        status: 'resolved',
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (tickets.length === 0) return 0;

    const totalTime = tickets.reduce((sum, ticket) => {
      if (!ticket.resolvedAt) return sum;
      const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + diff;
    }, 0);

    return Math.round(totalTime / tickets.length / 1000 / 60 / 60);
  }

  private getTicketsByStatus(tenantId: string) {
    return this.prisma.ticket.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });
  }

  private getTicketsBySeverity(tenantId: string) {
    return this.prisma.ticket.groupBy({
      by: ['severity'],
      where: { tenantId },
      _count: true,
    });
  }

  private getTicketsByType(tenantId: string) {
    return this.prisma.ticket.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: true,
    });
  }

  private async getAvgFirstResponseTime(_tenantId: string) {
    // Placeholder - would need agent_messages table
    return 2.5; // hours
  }

  private async getResolutionRate(tenantId: string) {
    const [total, resolved] = await Promise.all([
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.ticket.count({
        where: { tenantId, status: 'resolved' },
      }),
    ]);

    return total > 0 ? (resolved / total) * 100 : 0;
  }

  private async getReopenRate(_tenantId: string) {
    // Placeholder - would need ticket history tracking
    return 5.2; // percentage
  }

  private async getCustomerSatisfaction(_tenantId: string) {
    // Placeholder - would need satisfaction ratings
    return 4.2; // out of 5
  }

  private getStartDate(period: 'day' | 'week' | 'month'): Date {
    const date = new Date();
    switch (period) {
      case 'day':
        date.setDate(date.getDate() - 1);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
    }
    return date;
  }

  private groupByDate(
    data: { createdAt: Date; status: string }[],
    period: 'day' | 'week' | 'month'
  ) {
    const buckets = new Map<string, number>();

    for (const item of data) {
      const d = new Date(item.createdAt);
      let key: string;
      switch (period) {
        case 'day':
          key = d.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week': {
          // Start of ISO week (Monday)
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d);
          monday.setDate(diff);
          key = monday.toISOString().split('T')[0];
          break;
        }
        case 'month':
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          break;
      }
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }
}
