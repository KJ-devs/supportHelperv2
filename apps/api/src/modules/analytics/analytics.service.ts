import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get dashboard overview statistics
   */
  async getOverview(tenantId: string, period: 'day' | 'week' | 'month' = 'week') {
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

  /**
   * Get ticket trends over time
   */
  async getTrends(tenantId: string, period: 'day' | 'week' | 'month' = 'week', days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch individual tickets and bucket them in application code,
    // since Prisma groupBy on timestamps creates one group per ms.
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

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(tenantId: string) {
    const [firstResponseTime, resolutionRate, reopenRate, customerSatisfaction] = await Promise.all(
      [
        this.getAvgFirstResponseTime(tenantId),
        this.getResolutionRate(tenantId),
        this.getReopenRate(tenantId),
        this.getCustomerSatisfaction(tenantId),
      ]
    );

    return {
      firstResponseTime,
      resolutionRate,
      reopenRate,
      customerSatisfaction,
    };
  }

  /**
   * Get agent performance statistics
   */
  async getAgentStats(tenantId: string) {
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
   * Get application statistics
   */
  async getApplicationStats(tenantId: string) {
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
              status: 'resolved',
            },
          }),
          this.prisma.ticket.count({
            where: {
              applicationId: app.id,
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

  private async getAvgFirstResponseTime(tenantId: string) {
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

  private async getReopenRate(tenantId: string) {
    // Placeholder - would need ticket history tracking
    return 5.2; // percentage
  }

  private async getCustomerSatisfaction(tenantId: string) {
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
    period: 'day' | 'week' | 'month',
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
