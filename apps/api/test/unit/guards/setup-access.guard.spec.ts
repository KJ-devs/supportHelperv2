import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SetupAccessGuard } from '../../../src/modules/setup/setup-access.guard';
import { SetupService } from '../../../src/modules/setup/setup.service';

describe('SetupAccessGuard', () => {
  let setupService: { isSetupCompleted: jest.Mock; hasAnyUser: jest.Mock };
  let guard: SetupAccessGuard;
  let jwtCanActivate: jest.SpyInstance;
  let request: { user?: { role: string } };

  const context = () =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    setupService = {
      isSetupCompleted: jest.fn().mockResolvedValue(false),
      hasAnyUser: jest.fn().mockResolvedValue(true),
    };
    guard = new SetupAccessGuard(setupService as unknown as SetupService);
    request = {};
    // Simulates the passport JWT check: attaches the user or rejects
    jwtCanActivate = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockImplementation(async () => true);
  });

  afterEach(() => jwtCanActivate.mockRestore());

  it('refuses every call once setup is completed', async () => {
    setupService.isSetupCompleted.mockResolvedValue(true);
    request.user = { role: 'owner' };

    await expect(guard.canActivate(context())).rejects.toThrow(ForbiddenException);
  });

  it('allows anonymous calls before the first admin exists', async () => {
    setupService.hasAnyUser.mockResolvedValue(false);

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it('requires a valid JWT once an admin exists', async () => {
    jwtCanActivate.mockRejectedValue(new UnauthorizedException());

    await expect(guard.canActivate(context())).rejects.toThrow(UnauthorizedException);
  });

  it.each(['owner', 'admin'])('allows the %s to continue the setup', async (role) => {
    request.user = { role };

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('refuses members', async () => {
    request.user = { role: 'member' };

    await expect(guard.canActivate(context())).rejects.toThrow(ForbiddenException);
  });
});
