import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type UserTokenType = 'password_reset' | 'invite';

export const USER_TOKEN_TTL_MS: Record<UserTokenType, number> = {
  password_reset: 60 * 60 * 1000, // 1 hour
  invite: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * One-time tokens delivered by email. Only a SHA-256 hash is persisted,
 * so a database leak does not expose usable links.
 */
@Injectable()
export class UserTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a new token and revokes any previous unused token of the same type. */
  async issue(userId: string, type: UserTokenType): Promise<string> {
    const token = randomBytes(32).toString('hex');

    await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({ where: { userId, type, usedAt: null } }),
      this.prisma.userToken.create({
        data: {
          userId,
          type,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + USER_TOKEN_TTL_MS[type]),
        },
      }),
    ]);

    return token;
  }

  /** Marks the token as used and returns its owner. Throws if invalid, used or expired. */
  async consume(token: string, types: UserTokenType[]): Promise<string> {
    const record = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !record ||
      !types.includes(record.type as UserTokenType) ||
      record.usedAt !== null ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('This link is invalid or has expired');
    }

    // Conditional update guards against the same token being used twice concurrently
    const { count } = await this.prisma.userToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) {
      throw new BadRequestException('This link is invalid or has expired');
    }

    return record.userId;
  }
}
