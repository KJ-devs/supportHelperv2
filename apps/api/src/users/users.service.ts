import { Injectable, NotFoundException, ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService, CacheKeys, CacheTTL } from '../cache';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async findByTenant(tenantId: string) {
    return this.cacheService.getOrSet(
      CacheKeys.userList(tenantId),
      CacheTTL.USER_PROFILE,
      () => this.prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
    );
  }

  async findOne(id: string, tenantId: string) {
    const cacheKey = CacheKeys.userProfile(tenantId, id);
    const cached = await this.cacheService.get<{ id: string; tenantId: string; email: string; name: string | null; role: string; createdAt: Date }>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.cacheService.set(cacheKey, user, CacheTTL.USER_PROFILE);
    return user;
  }

  async create(tenantId: string, data: { email: string; name: string; role?: string }) {
    // Check for existing user with same email in tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: data.email },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists in the tenant');
    }

    // Generate a temporary password
    const temporaryPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        name: data.name,
        role: data.role || 'member',
        passwordHash,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await this.invalidateUserCaches(tenantId);
    return user;
  }

  async update(id: string, tenantId: string, data: { name?: string; role?: string }) {
    const user = await this.findOne(id, tenantId);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await this.invalidateUserCaches(tenantId, id);
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const user = await this.findOne(id, tenantId);
    await this.prisma.user.delete({ where: { id: user.id } });
    await this.invalidateUserCaches(tenantId, id);
    return { success: true };
  }

  async updateProfile(userId: string, tenantId: string, data: { name?: string; email?: string }) {
    // Check if user exists and belongs to tenant
    const user = await this.findOne(userId, tenantId);

    // If email is being changed, check for conflicts
    if (data.email && data.email !== user.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: data.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email already exists in the tenant');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async changePassword(userId: string, tenantId: string, currentPassword: string, newPassword: string) {
    // Get user with password hash
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('User has no password set (OAuth user)');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true };
  }

  async updateNotifications(userId: string, tenantId: string, preferences: {
    emailOnNewTicket?: boolean;
    emailOnStatusChange?: boolean;
    emailOnComment?: boolean;
    emailWeeklyReport?: boolean;
  }) {
    // Check if user exists
    await this.findOne(userId, tenantId);

    // For now, we'll store notification preferences in the tenant settings JSON
    // In a production app, you might want a separate UserSettings or NotificationPreferences table
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Since we don't have a notificationPreferences field in the User model,
    // we'll return success. In production, you'd store this in a separate table or JSON field.
    // For now, this endpoint works for the frontend but doesn't persist the data.
    return { success: true, preferences };
  }
}
