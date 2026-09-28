import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { UserTokensService } from '../../../src/users/user-tokens.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('UserTokensService', () => {
  let service: UserTokensService;
  let prisma: {
    $transaction: jest.Mock;
    userToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockResolvedValue([]),
      userToken: {
        deleteMany: jest.fn().mockReturnValue('deleteMany-op'),
        create: jest.fn().mockReturnValue('create-op'),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new UserTokensService(prisma as unknown as PrismaService);
  });

  describe('issue', () => {
    it('stores only the hash of a random token and revokes previous ones', async () => {
      const token = await service.issue('user-1', 'password_reset');

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: 'password_reset', usedAt: null },
      });
      const created = prisma.userToken.create.mock.calls[0][0].data;
      expect(created.tokenHash).toBe(sha256(token));
      expect(created.tokenHash).not.toBe(token);
      expect(prisma.$transaction).toHaveBeenCalledWith(['deleteMany-op', 'create-op']);
    });

    it('gives invitations a longer lifetime than password resets', async () => {
      await service.issue('user-1', 'password_reset');
      await service.issue('user-1', 'invite');

      const [reset, invite] = prisma.userToken.create.mock.calls.map((c) => c[0].data.expiresAt.getTime());
      expect(invite - reset).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    });
  });

  describe('consume', () => {
    const validRecord = () => ({
      id: 'tok-1',
      userId: 'user-1',
      type: 'password_reset',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('returns the owner and marks the token as used', async () => {
      prisma.userToken.findUnique.mockResolvedValue(validRecord());

      await expect(service.consume('raw', ['password_reset'])).resolves.toBe('user-1');
      expect(prisma.userToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: sha256('raw') } });
      expect(prisma.userToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'tok-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it.each([
      ['unknown', null],
      ['already used', { ...validRecord(), usedAt: new Date() }],
      ['expired', { ...validRecord(), expiresAt: new Date(Date.now() - 1) }],
      ['of another type', { ...validRecord(), type: 'invite' }],
    ])('rejects a token that is %s', async (_label, record) => {
      prisma.userToken.findUnique.mockResolvedValue(record);

      await expect(service.consume('raw', ['password_reset'])).rejects.toThrow(BadRequestException);
      expect(prisma.userToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a token consumed concurrently by another request', async () => {
      prisma.userToken.findUnique.mockResolvedValue(validRecord());
      prisma.userToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.consume('raw', ['password_reset'])).rejects.toThrow(BadRequestException);
    });
  });
});
