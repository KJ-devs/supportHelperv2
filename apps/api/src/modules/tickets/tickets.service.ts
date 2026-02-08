import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto, UpdateTicketDto, FilterTicketsDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new ticket
   */
  async create(
    tenantId: string,
    dto: CreateTicketDto,
    reporterId?: string,
  ) {
    const data: Prisma.TicketCreateInput = {
      title: dto.title,
      description: dto.description,
      userContext: dto.userContext as Prisma.JsonObject,
      reproductionSteps: dto.reproductionSteps as Prisma.JsonObject,
      sessionId: dto.sessionId,
      tenant: {
        connect: { id: tenantId },
      },
      application: {
        connect: { id: dto.applicationId! },
      },
      ...(reporterId && {
        reporter: {
          connect: { id: reporterId },
        },
      }),
    };

    const ticket = await this.prisma.ticket.create({
      data,
      include: {
        application: {
          select: {
            id: true,
            name: true,
            platform: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Created ticket ${ticket.id} for tenant ${tenantId}`);

    return ticket;
  }

  /**
   * Find all tickets with filters and pagination
   * TanStack Query compatible
   */
  async findAll(tenantId: string, filters: FilterTicketsDto) {
    const {
      page = 0,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
      severity,
      applicationId,
      assignedTo,
      reporterId,
      search,
      createdFrom,
      createdTo,
    } = filters;

    // Build where clause
    const where: Prisma.TicketWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(type && { type }),
      ...(severity && { severity }),
      ...(applicationId && { applicationId }),
      ...(assignedTo && { assignedTo }),
      ...(reporterId && { reporterId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { aiSummary: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(createdFrom || createdTo
        ? {
            createdAt: {
              ...(createdFrom && { gte: new Date(createdFrom) }),
              ...(createdTo && { lte: new Date(createdTo) }),
            },
          }
        : {}),
    };

    // Execute queries in parallel
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          application: {
            select: {
              id: true,
              name: true,
              platform: true,
            },
          },
          reporter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              media: true,
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: (page + 1) * limit < total,
      },
    };
  }

  /**
   * Find one ticket by ID
   */
  async findOne(ticketId: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId,
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            platform: true,
            githubRepo: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        media: {
          orderBy: { createdAt: 'desc' },
        },
        githubIssues: {
          select: {
            id: true,
            githubIssueNumber: true,
            githubRepo: true,
            githubIssueUrl: true,
            syncStatus: true,
            lastSyncedAt: true,
          },
        },
        agentSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            escalatedTo: true,
            escalationReason: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return ticket;
  }

  /**
   * Update ticket
   */
  async update(ticketId: string, tenantId: string, dto: UpdateTicketDto) {
    // Verify ticket exists and belongs to tenant
    await this.findOne(ticketId, tenantId);

    const data: Prisma.TicketUpdateInput = {
      ...(dto.title && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status && { status: dto.status }),
      ...(dto.type && { type: dto.type }),
      ...(dto.severity && { severity: dto.severity }),
      ...(dto.reproductionSteps && {
        reproductionSteps: dto.reproductionSteps as Prisma.JsonObject,
      }),
      ...(dto.aiSummary !== undefined && { aiSummary: dto.aiSummary }),
      ...(dto.aiAnalysis && {
        aiAnalysis: dto.aiAnalysis as Prisma.JsonObject,
      }),
    };

    // Update resolvedAt if status changed to resolved
    if (dto.status === 'resolved') {
      data.resolvedAt = new Date();
    } else if (dto.status) {
      data.resolvedAt = null;
    }

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: {
        application: true,
        reporter: true,
        assignee: true,
      },
    });

    this.logger.log(`Updated ticket ${ticketId}`);

    return ticket;
  }

  /**
   * Delete ticket (soft delete by setting status to closed)
   */
  async remove(ticketId: string, tenantId: string) {
    // Verify ticket exists and belongs to tenant
    await this.findOne(ticketId, tenantId);

    // Soft delete
    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'closed',
        resolvedAt: new Date(),
      },
    });

    this.logger.log(`Deleted (closed) ticket ${ticketId}`);

    return ticket;
  }

  /**
   * Assign ticket to user
   */
  async assign(ticketId: string, tenantId: string, userId: string | null) {
    // Verify ticket exists and belongs to tenant
    await this.findOne(ticketId, tenantId);

    // If assigning to a user, verify user exists and belongs to tenant
    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
      });

      if (!user) {
        throw new ForbiddenException(
          'User not found or does not belong to this tenant',
        );
      }
    }

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedTo: userId,
        assignedAt: userId ? new Date() : null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `${userId ? 'Assigned' : 'Unassigned'} ticket ${ticketId} ${userId ? `to user ${userId}` : ''}`,
    );

    return ticket;
  }

  /**
   * Get ticket statistics
   */
  async getStats(tenantId: string) {
    const [
      total,
      byStatus,
      bySeverity,
      byType,
      recentTickets,
      avgResolutionTime,
    ] = await Promise.all([
      // Total tickets
      this.prisma.ticket.count({ where: { tenantId } }),

      // By status
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),

      // By severity
      this.prisma.ticket.groupBy({
        by: ['severity'],
        where: { tenantId, severity: { not: null } },
        _count: true,
      }),

      // By type
      this.prisma.ticket.groupBy({
        by: ['type'],
        where: { tenantId, type: { not: null } },
        _count: true,
      }),

      // Recent tickets (last 7 days)
      this.prisma.ticket.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Average resolution time (in hours)
      this.calculateAvgResolutionTime(tenantId),
    ]);

    return {
      total,
      byStatus: this.formatGroupByResult(byStatus, 'status'),
      bySeverity: this.formatGroupByResult(bySeverity, 'severity'),
      byType: this.formatGroupByResult(byType, 'type'),
      recentTickets,
      avgResolutionTimeHours: avgResolutionTime,
    };
  }

  /**
   * Calculate average resolution time in hours
   */
  private async calculateAvgResolutionTime(tenantId: string): Promise<number> {
    const resolvedTickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        status: 'resolved',
        resolvedAt: { not: null },
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedTickets.length === 0) return 0;

    const totalTime = resolvedTickets.reduce((sum, ticket) => {
      if (!ticket.resolvedAt) return sum;
      const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + diff;
    }, 0);

    const avgMilliseconds = totalTime / resolvedTickets.length;
    return Math.round(avgMilliseconds / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Format Prisma groupBy result
   */
  private formatGroupByResult(
    result: any[],
    key: string,
  ): Record<string, number> {
    return result.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = item._count;
      return acc;
    }, {});
  }
}
