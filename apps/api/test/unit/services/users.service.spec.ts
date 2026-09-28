import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { CacheService } from '../../../src/cache/cache.service';
import { UserTokensService } from '../../../src/users/user-tokens.service';
import { MailService } from '../../../src/common/mail/mail.service';
import { ConfigService } from '@nestjs/config';

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

  const mockUserTokens = { issue: jest.fn(), consume: jest.fn() };
  const mockMailService = { send: jest.fn() };

  beforeEach(async () => {
    mockUserTokens.issue.mockReset().mockResolvedValue('invite-token');
    mockMailService.send.mockReset().mockResolvedValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            tenant: { findUniqueOrThrow: jest.fn() },
          },
        },
        { provide: UserTokensService, useValue: mockUserTokens },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://dash.test') } },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            getOrSet: jest.fn().mockImplementation((_key, _ttl, factory) => factory()),
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
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { ...mockUser, passwordHash: 'hash', authProvider: null },
        { ...mockUser, id: 'invited', passwordHash: null, authProvider: null },
      ]);

      const result = await service.findByTenant('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result.map((u) => u.invitationPending)).toEqual([false, true]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-123' },
          select: expect.objectContaining({ id: true, email: true }),
        }),
      );
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
    it('should create a pending user without password and email an invitation', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, id: 'new-user' });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: 'new-user', email: 'new@test.com' });
      (prisma.tenant.findUniqueOrThrow as jest.Mock).mockResolvedValue({ name: 'Acme' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ name: 'Alice', email: 'alice@acme.test' });

      const result = await service.create('tenant-123', { email: 'New@Test.com', name: 'New User' }, 'inviter-1');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-123',
          email: 'new@test.com',
          name: 'New User',
          role: 'member',
          passwordHash: null,
        }),
        select: expect.any(Object),
      });
      expect(mockUserTokens.issue).toHaveBeenCalledWith('new-user', 'invite');
      expect(mockMailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@test.com',
          html: expect.stringContaining('http://dash.test/reset-password?token=invite-token&amp;invite=1'),
        }),
      );
      expect(result).toMatchObject({ invitationPending: true, invitationSent: true });
    });

    it('should still create the user when the invitation email fails', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, id: 'new-user' });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: 'new-user', email: 'new@test.com' });
      (prisma.tenant.findUniqueOrThrow as jest.Mock).mockResolvedValue({ name: 'Acme' });
      mockMailService.send.mockRejectedValue(new Error('SMTP down'));

      const result = await service.create('tenant-123', { email: 'new@test.com', name: 'New' }, 'inviter-1');

      expect(result).toMatchObject({ invitationPending: true, invitationSent: false });
    });

    it('should throw ConflictException for duplicate email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.create('tenant-123', { email: 'test@example.com', name: 'Dup' }, 'inviter-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should use custom role when provided', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser, role: 'admin' });

      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: 'user-123', email: 'admin@test.com' });
      (prisma.tenant.findUniqueOrThrow as jest.Mock).mockResolvedValue({ name: 'Acme' });

      await service.create('tenant-123', { email: 'admin@test.com', name: 'Admin', role: 'admin' }, 'inviter-1');

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
