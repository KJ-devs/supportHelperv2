import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SetupNotCompletedGuard } from '../../../src/modules/setup/guards/setup-not-completed.guard';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('SetupNotCompletedGuard', () => {
  let guard: SetupNotCompletedGuard;
  let prismaService: jest.Mocked<Pick<PrismaService, 'user'>>;

  // A minimal ExecutionContext — the guard does not inspect it
  const mockContext = {} as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupNotCompletedGuard,
        {
          provide: PrismaService,
          useValue: {
            user: {
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<SetupNotCompletedGuard>(SetupNotCompletedGuard);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true (allow) when no users exist (setup not yet completed)', async () => {
    (prismaService.user.count as jest.Mock).mockResolvedValue(0);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(prismaService.user.count).toHaveBeenCalledTimes(1);
  });

  it('should throw ForbiddenException when at least one user exists (setup already completed)', async () => {
    (prismaService.user.count as jest.Mock).mockResolvedValue(1);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(mockContext)).rejects.toThrow('Setup already completed');
  });

  it('should throw ForbiddenException regardless of how many users exist', async () => {
    (prismaService.user.count as jest.Mock).mockResolvedValue(42);

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });
});
