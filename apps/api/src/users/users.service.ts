import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string, tenantId: string) {
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

    return user;
  }

  async update(id: string, tenantId: string, data: { name?: string; role?: string }) {
    const user = await this.findOne(id, tenantId);

    return this.prisma.user.update({
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
  }

  async delete(id: string, tenantId: string) {
    const user = await this.findOne(id, tenantId);
    await this.prisma.user.delete({ where: { id: user.id } });
    return { success: true };
  }
}
