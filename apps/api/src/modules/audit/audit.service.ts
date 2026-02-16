import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLog } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Core logging method - called from services or interceptor
   * Non-blocking: errors are logged but don't fail the operation
   */
  async log(params: {
    tenantId: string;
    actorId?: string;
    actorType: 'user' | 'system' | 'agent';
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorId: params.actorId || null,
          actorType: params.actorType,
          action: params.action,
          resourceType: params.resourceType || null,
          resourceId: params.resourceId || null,
          details: params.details || {},
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break operations
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Query logs with filters and pagination
   */
  async findAll(
    tenantId: string,
    filters: {
      actorId?: string;
      action?: string;
      resourceType?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    data: AuditLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filters.page || 0;
    const limit = filters.limit || 50;

    // Build where clause
    const where: any = { tenantId };

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.action) {
      where.action = { contains: filters.action, mode: 'insensitive' };
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Get total count and data in parallel
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: page * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Export logs as CSV string
   */
  async exportCsv(
    tenantId: string,
    filters: {
      actorId?: string;
      action?: string;
      resourceType?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<string> {
    // Build where clause (same as findAll but without pagination)
    const where: any = { tenantId };

    if (filters.actorId) {
      where.actorId = filters.actorId;
    }

    if (filters.action) {
      where.action = { contains: filters.action, mode: 'insensitive' };
    }

    if (filters.resourceType) {
      where.resourceType = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Fetch all matching logs (no pagination for export)
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // CSV header
    const headers = [
      'timestamp',
      'actor_id',
      'actor_type',
      'action',
      'resource_type',
      'resource_id',
      'details',
      'ip_address',
    ];

    // CSV rows
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.actorId || '',
      log.actorType,
      log.action,
      log.resourceType || '',
      log.resourceId || '',
      JSON.stringify(log.details),
      log.ipAddress || '',
    ]);

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => this.escapeCsvCell(cell.toString())).join(','),
      ),
    ].join('\n');

    return csvContent;
  }

  /**
   * Purge old logs (called by cron job)
   * Returns number of deleted records
   */
  async purgeOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    this.logger.log(
      `Purging audit logs older than ${cutoff.toISOString()} (${retentionDays} days)`,
    );

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    this.logger.log(`Purged ${result.count} old audit logs`);

    return result.count;
  }

  /**
   * Helper: Escape CSV cell content
   */
  private escapeCsvCell(cell: string): string {
    // Escape quotes and wrap in quotes if cell contains comma, quote, or newline
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }
}
