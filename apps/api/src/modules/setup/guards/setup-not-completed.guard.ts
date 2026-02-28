import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Guard that blocks setup write endpoints once setup is completed.
 *
 * Setup is considered complete when at least one user exists in the database.
 * This matches the existing check in SetupService.createAdmin() and
 * SetupService.completeSetup().
 *
 * Apply to all POST endpoints in SetupController so that an attacker cannot
 * overwrite SMTP config, AI keys, or progress on a running instance.
 * GET /setup/status must remain public and must NOT use this guard.
 */
@Injectable()
export class SetupNotCompletedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const userCount = await this.prisma.user.count();

    if (userCount > 0) {
      throw new ForbiddenException('Setup already completed');
    }

    return true;
  }
}
