import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from '../../../src/users/users.controller';
import { UsersService } from '../../../src/users/users.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockTenantId = 'tenant-123';

  const mockUsers = [
    { id: 'user-001', email: 'alice@example.com', name: 'Alice', role: 'owner', createdAt: new Date() },
    { id: 'user-002', email: 'bob@example.com', name: 'Bob', role: 'admin', createdAt: new Date() },
    { id: 'user-003', email: 'carol@example.com', name: 'Carol', role: 'member', createdAt: new Date() },
  ];

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users for the tenant', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const req = { user: { tenantId: mockTenantId } };
      const result = await controller.findAll(req);

      expect(result).toEqual(mockUsers);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: mockTenantId },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          role: true,
        }),
      });
    });

    it('should scope query to tenant from JWT', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const req = { user: { tenantId: 'other-tenant' } };
      await controller.findAll(req);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'other-tenant' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user by ID within the tenant', async () => {
      const user = {
        id: 'user-001', tenantId: mockTenantId, email: 'alice@example.com',
        name: 'Alice', role: 'owner', createdAt: new Date(),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(user);

      const req = { user: { tenantId: mockTenantId } };
      const result = await controller.findOne('user-001', req);

      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user is not in tenant', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      const req = { user: { tenantId: mockTenantId } };
      await expect(controller.findOne('nonexistent', req)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = { email: 'new@example.com', name: 'New User' };

    it('should allow owner to create a user', async () => {
      const createdUser = {
        id: 'user-new', tenantId: mockTenantId, ...createDto,
        role: 'member', createdAt: new Date(),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const req = { user: { id: 'user-001', tenantId: mockTenantId, role: 'owner' } };
      const result = await controller.create(createDto, req);

      expect(result).toEqual(createdUser);
    });

    it('should allow admin to create a user', async () => {
      const createdUser = {
        id: 'user-new', tenantId: mockTenantId, ...createDto,
        role: 'member', createdAt: new Date(),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const req = { user: { id: 'user-002', tenantId: mockTenantId, role: 'admin' } };
      const result = await controller.create(createDto, req);

      expect(result).toEqual(createdUser);
    });

    it('should throw ForbiddenException when member tries to create user', async () => {
      const req = { user: { id: 'user-003', tenantId: mockTenantId, role: 'member' } };

      await expect(controller.create(createDto, req)).rejects.toThrow(ForbiddenException);
      await expect(controller.create(createDto, req)).rejects.toThrow(
        'Only owners and admins can create users',
      );
    });

    it('should throw ForbiddenException when viewer tries to create user', async () => {
      const req = { user: { id: 'user-004', tenantId: mockTenantId, role: 'viewer' } };

      await expect(controller.create(createDto, req)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should allow updating user name without role check', async () => {
      const user = {
        id: 'user-003', tenantId: mockTenantId, email: 'carol@example.com',
        name: 'Carol', role: 'member', createdAt: new Date(),
      };
      const updatedUser = { ...user, name: 'Carol Updated' };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const req = { user: { id: 'user-003', tenantId: mockTenantId, role: 'member' } };
      const result = await controller.update('user-003', { name: 'Carol Updated' }, req);

      expect(result).toEqual(updatedUser);
    });

    it('should allow owner to change another user role', async () => {
      const user = {
        id: 'user-003', tenantId: mockTenantId, email: 'carol@example.com',
        name: 'Carol', role: 'member', createdAt: new Date(),
      };
      const updatedUser = { ...user, role: 'admin' };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const req = { user: { id: 'user-001', tenantId: mockTenantId, role: 'owner' } };
      const result = await controller.update('user-003', { role: 'admin' as any }, req);

      expect(result.role).toBe('admin');
    });

    it('should allow admin to change another user role', async () => {
      const user = {
        id: 'user-003', tenantId: mockTenantId, email: 'carol@example.com',
        name: 'Carol', role: 'member', createdAt: new Date(),
      };
      const updatedUser = { ...user, role: 'admin' };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const req = { user: { id: 'user-002', tenantId: mockTenantId, role: 'admin' } };
      const result = await controller.update('user-003', { role: 'admin' as any }, req);

      expect(result.role).toBe('admin');
    });

    it('should throw ForbiddenException when member tries to change role', async () => {
      const req = { user: { id: 'user-003', tenantId: mockTenantId, role: 'member' } };

      await expect(
        controller.update('user-002', { role: 'admin' as any }, req),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.update('user-002', { role: 'admin' as any }, req),
      ).rejects.toThrow('Only owners and admins can change user roles');
    });

    it('should prevent owner from changing their own role', async () => {
      const req = { user: { id: 'user-001', tenantId: mockTenantId, role: 'owner' } };

      await expect(
        controller.update('user-001', { role: 'member' as any }, req),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.update('user-001', { role: 'member' as any }, req),
      ).rejects.toThrow('Cannot change your own role');
    });

    it('should prevent admin from changing their own role', async () => {
      const req = { user: { id: 'user-002', tenantId: mockTenantId, role: 'admin' } };

      await expect(
        controller.update('user-002', { role: 'member' as any }, req),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.update('user-002', { role: 'member' as any }, req),
      ).rejects.toThrow('Cannot change your own role');
    });

    it('should allow name update even when role is undefined in dto', async () => {
      const user = {
        id: 'user-003', tenantId: mockTenantId, email: 'carol@example.com',
        name: 'Carol', role: 'member', createdAt: new Date(),
      };
      const updatedUser = { ...user, name: 'New Name' };

      mockPrismaService.user.findFirst.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const req = { user: { id: 'user-003', tenantId: mockTenantId, role: 'member' } };
      const result = await controller.update('user-003', { name: 'New Name' }, req);

      expect(result.name).toBe('New Name');
    });
  });

  describe('delete', () => {
    it('should allow owner to delete another user', async () => {
      const user = {
        id: 'user-003', tenantId: mockTenantId, email: 'carol@example.com',
        name: 'Carol', role: 'member', createdAt: new Date(),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(user);
      mockPrismaService.user.delete.mockResolvedValue(user);

      const req = { user: { id: 'user-001', tenantId: mockTenantId, role: 'owner' } };
      const result = await controller.delete('user-003', req);

      expect(result).toEqual({ success: true });
    });

    it('should allow admin to delete another user', async () => {
      const user = {
        id: 'user-003', tenantId: mockTenantId, email: 'carol@example.com',
        name: 'Carol', role: 'member', createdAt: new Date(),
      };
      mockPrismaService.user.findFirst.mockResolvedValue(user);
      mockPrismaService.user.delete.mockResolvedValue(user);

      const req = { user: { id: 'user-002', tenantId: mockTenantId, role: 'admin' } };
      const result = await controller.delete('user-003', req);

      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException when member tries to delete user', async () => {
      const req = { user: { id: 'user-003', tenantId: mockTenantId, role: 'member' } };

      await expect(controller.delete('user-002', req)).rejects.toThrow(ForbiddenException);
      await expect(controller.delete('user-002', req)).rejects.toThrow(
        'Only owners and admins can delete users',
      );
    });

    it('should throw ForbiddenException when viewer tries to delete user', async () => {
      const req = { user: { id: 'user-004', tenantId: mockTenantId, role: 'viewer' } };

      await expect(controller.delete('user-002', req)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when owner tries to delete themselves', async () => {
      const req = { user: { id: 'user-001', tenantId: mockTenantId, role: 'owner' } };

      await expect(controller.delete('user-001', req)).rejects.toThrow(ForbiddenException);
      await expect(controller.delete('user-001', req)).rejects.toThrow(
        'Cannot delete yourself',
      );
    });

    it('should throw ForbiddenException when admin tries to delete themselves', async () => {
      const req = { user: { id: 'user-002', tenantId: mockTenantId, role: 'admin' } };

      await expect(controller.delete('user-002', req)).rejects.toThrow(ForbiddenException);
      await expect(controller.delete('user-002', req)).rejects.toThrow(
        'Cannot delete yourself',
      );
    });
  });
});
