import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto, UpdateTicketDto, FilterTicketsDto, BulkTicketDto } from './dto';
import { TicketsGateway } from './tickets.gateway';
import { CacheService, CacheKeys, CacheTTL } from '../../cache';
import { Prisma } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TicketsGateway))
    private readonly ticketsGateway: TicketsGateway,
    private readonly cacheService: CacheService,
  ) {}

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

    // Invalidate ticket list and stats caches for this tenant
    await this.invalidateTicketCaches(tenantId);

    // Emit real-time event
    this.ticketsGateway.emitTicketCreated(tenantId, ticket);

    return ticket;
  }

  /**
   * Find all tickets with filters and pagination
   * TanStack Query compatible. Results are cached for 5 min.
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

    // Only cache non-search queries (search results change too frequently)
    const filterHash = this.cacheService.hashFilters(filters);
    const cacheKey = CacheKeys.ticketList(tenantId, filterHash);

    if (!search) {
      const cached = await this.cacheService.get<any>(cacheKey);
      if (cached) return cached;
    }

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

    const result = {
      data: tickets.map(t => ({
        ...t,
        typeConfidence: t.typeConfidence ? Number(t.typeConfidence) : null,
        severityConfidence: t.severityConfidence ? Number(t.severityConfidence) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: (page + 1) * limit < total,
      },
    };

    // Cache non-search results
    if (!search) {
      await this.cacheService.set(cacheKey, result, CacheTTL.TICKETS);
    }

    return result;
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

    // Convert Prisma Decimal/BigInt to plain numbers for JSON serialization
    return {
      ...ticket,
      typeConfidence: ticket.typeConfidence ? Number(ticket.typeConfidence) : null,
      severityConfidence: ticket.severityConfidence ? Number(ticket.severityConfidence) : null,
      media: ticket.media.map(m => ({
        ...m,
        fileSize: m.fileSize ? Number(m.fileSize) : null,
      })),
    };
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

    const result = {
      ...ticket,
      typeConfidence: ticket.typeConfidence ? Number(ticket.typeConfidence) : null,
      severityConfidence: ticket.severityConfidence ? Number(ticket.severityConfidence) : null,
    };

    // Invalidate caches
    await this.invalidateTicketCaches(tenantId, ticketId);

    // Emit real-time event
    this.ticketsGateway.emitTicketUpdated(tenantId, result);

    return result;
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

    // Invalidate caches
    await this.invalidateTicketCaches(tenantId, ticketId);

    // Emit real-time event
    this.ticketsGateway.emitTicketDeleted(tenantId, ticketId);

    return {
      ...ticket,
      typeConfidence: ticket.typeConfidence ? Number(ticket.typeConfidence) : null,
      severityConfidence: ticket.severityConfidence ? Number(ticket.severityConfidence) : null,
    };
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

    const result = {
      ...ticket,
      typeConfidence: ticket.typeConfidence ? Number(ticket.typeConfidence) : null,
      severityConfidence: ticket.severityConfidence ? Number(ticket.severityConfidence) : null,
    };

    // Invalidate caches
    await this.invalidateTicketCaches(tenantId, ticketId);

    // Emit real-time event
    this.ticketsGateway.emitTicketAssigned(tenantId, result);

    return result;
  }

  /**
   * Bulk ticket operations
   */
  async bulkAction(
    tenantId: string,
    dto: BulkTicketDto,
  ): Promise<{ processed: number; failed: number; errors: string[] }> {
    const { ticketIds, action, value } = dto;
    const errors: string[] = [];

    // Verify all ticket IDs belong to this tenant
    const existingTickets = await this.prisma.ticket.findMany({
      where: {
        id: { in: ticketIds },
        tenantId,
      },
      select: { id: true },
    });

    const existingIds = new Set(existingTickets.map((t) => t.id));
    const missingIds = ticketIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      errors.push(
        `Tickets not found or not accessible: ${missingIds.join(', ')}`,
      );
    }

    const validIds = ticketIds.filter((id) => existingIds.has(id));

    if (validIds.length === 0) {
      return { processed: 0, failed: ticketIds.length, errors };
    }

    // For assign action, verify user belongs to tenant
    if (action === 'assign' && value) {
      const user = await this.prisma.user.findFirst({
        where: { id: value as string, tenantId },
      });
      if (!user) {
        throw new BadRequestException(
          'User not found or does not belong to this tenant',
        );
      }
    }

    // Execute bulk operation in a transaction
    let processed = 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        switch (action) {
          case 'update_status': {
            const data: Prisma.TicketUpdateManyMutationInput = {
              status: value as string,
            };
            if (value === 'resolved') {
              data.resolvedAt = new Date();
            } else {
              data.resolvedAt = null;
            }
            const result = await tx.ticket.updateMany({
              where: { id: { in: validIds }, tenantId },
              data,
            });
            processed = result.count;
            break;
          }

          case 'assign': {
            const result = await tx.ticket.updateMany({
              where: { id: { in: validIds }, tenantId },
              data: {
                assignedTo: value as string,
                assignedAt: new Date(),
              },
            });
            processed = result.count;
            break;
          }

          case 'unassign': {
            const result = await tx.ticket.updateMany({
              where: { id: { in: validIds }, tenantId },
              data: {
                assignedTo: null,
                assignedAt: null,
              },
            });
            processed = result.count;
            break;
          }

          case 'change_priority': {
            const result = await tx.ticket.updateMany({
              where: { id: { in: validIds }, tenantId },
              data: { priority: value as number },
            });
            processed = result.count;
            break;
          }

          case 'change_severity': {
            const result = await tx.ticket.updateMany({
              where: { id: { in: validIds }, tenantId },
              data: { severity: value as string },
            });
            processed = result.count;
            break;
          }

          case 'delete': {
            // Soft delete: set status to closed
            const result = await tx.ticket.updateMany({
              where: { id: { in: validIds }, tenantId },
              data: {
                status: 'closed',
                resolvedAt: new Date(),
              },
            });
            processed = result.count;
            break;
          }
        }
      });
    } catch (error) {
      this.logger.error(`Bulk action failed: ${error}`);
      errors.push('Transaction failed: an unexpected error occurred');
      return { processed: 0, failed: validIds.length, errors };
    }

    this.logger.log(
      `Bulk ${action}: processed ${processed}/${ticketIds.length} tickets for tenant ${tenantId}`,
    );

    // Invalidate all ticket caches for this tenant after bulk action
    await this.invalidateTicketCaches(tenantId);

    return {
      processed,
      failed: ticketIds.length - processed,
      errors,
    };
  }

  /**
   * Get ticket statistics (cached for 10 min)
   */
  async getStats(tenantId: string) {
    const cacheKey = CacheKeys.ticketStats(tenantId);
    return this.cacheService.getOrSet(cacheKey, CacheTTL.TICKET_STATS, async () => {
      const [
        total,
        byStatus,
        bySeverity,
        byType,
        recentTickets,
        avgResolutionTime,
      ] = await Promise.all([
        this.prisma.ticket.count({ where: { tenantId } }),
        this.prisma.ticket.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: true,
        }),
        this.prisma.ticket.groupBy({
          by: ['severity'],
          where: { tenantId, severity: { not: null } },
          _count: true,
        }),
        this.prisma.ticket.groupBy({
          by: ['type'],
          where: { tenantId, type: { not: null } },
          _count: true,
        }),
        this.prisma.ticket.count({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
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
    });
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
   * Invalidate ticket-related caches for a tenant.
   * Optionally invalidate a specific ticket detail cache.
   */
  private async invalidateTicketCaches(tenantId: string, ticketId?: string): Promise<void> {
    const promises: Promise<void>[] = [
      this.cacheService.invalidateByPrefix(`tenant:${tenantId}:tickets:list:`),
      this.cacheService.del(CacheKeys.ticketStats(tenantId)),
    ];

    if (ticketId) {
      promises.push(this.cacheService.del(CacheKeys.ticketDetail(tenantId, ticketId)));
    }

    // Also invalidate analytics caches since they depend on ticket data
    promises.push(this.cacheService.invalidateByPrefix(`tenant:${tenantId}:analytics:`));

    await Promise.all(promises);
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
