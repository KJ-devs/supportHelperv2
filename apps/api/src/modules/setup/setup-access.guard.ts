import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SetupService } from './setup.service';

const SETUP_ROLES = ['owner', 'admin'];

/**
 * Protects setup wizard mutations.
 *
 * - Once setup is completed, every wizard mutation is refused.
 * - Before the first admin exists, anonymous access is allowed (wizard step 1).
 * - After the first admin exists, a valid JWT with owner/admin role is required,
 *   so nobody else can hijack the remaining wizard steps.
 */
@Injectable()
export class SetupAccessGuard extends AuthGuard('jwt') {
  constructor(private readonly setupService: SetupService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (await this.setupService.isSetupCompleted()) {
      throw new ForbiddenException('Setup has already been completed');
    }

    if (!(await this.setupService.hasAnyUser())) {
      return true;
    }

    await super.canActivate(context);

    const { user } = context.switchToHttp().getRequest();
    if (!user || !SETUP_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only the organization owner or an admin can run the setup');
    }

    return true;
  }
}
