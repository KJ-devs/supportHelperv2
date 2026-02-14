import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'member',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByTenant', () => {
    it('should return users for tenant', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);

      const result = await service.findByTenant('tenant-123');

      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        select: expect.objectContaining({ id: true, email: true }),
      });
    });
  });

  describe('findOne', () => {
    it('should return user by id and tenant', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findOne('user-123', 'tenant-123');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing', 'tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create user with hashed temporary password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.create('tenant-123', { email: 'new@test.com', name: 'New User' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-123',
          email: 'new@test.com',
          name: 'New User',
          role: 'member',
          passwordHash: 'hashed-password',
        }),
        select: expect.any(Object),
      });
    });

    it('should throw ConflictException for duplicate email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.create('tenant-123', { email: 'test@example.com', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should use custom role when provided', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, role: 'admin' });

      await service.create('tenant-123', { email: 'admin@test.com', name: 'Admin', role: 'admin' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'admin' }),
        select: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, name: 'Updated' });

      const result = await service.update('user-123', 'tenant-123', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when user not found', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update('missing', 'tenant-123', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete user and return success', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.delete as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.delete('user-123', 'tenant-123');

      expect(result).toEqual({ success: true });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-123' } });
    });
  });
});
