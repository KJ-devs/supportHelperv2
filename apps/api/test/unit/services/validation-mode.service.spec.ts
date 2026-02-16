import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ValidationModeService } from '../../../src/modules/agent-tasks/services/validation-mode.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

describe('ValidationModeService', () => {
  let service: ValidationModeService;
  let prisma: {
    projectGithubConfig: {
      findUnique: jest.Mock;
    };
    agentTask: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      projectGithubConfig: {
        findUnique: jest.fn(),
      },
      agentTask: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationModeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ValidationModeService>(ValidationModeService);
  });

  describe('getAgentMode', () => {
    it('should return "auto" when no config exists', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue(null);
      const mode = await service.getAgentMode('app-1');
      expect(mode).toBe('auto');
    });

    it('should return "auto" when settings.agentMode is not set', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: {},
      });
      const mode = await service.getAgentMode('app-1');
      expect(mode).toBe('auto');
    });

    it('should return "review_plan" when configured', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: { agentMode: 'review_plan' },
      });
      const mode = await service.getAgentMode('app-1');
      expect(mode).toBe('review_plan');
    });

    it('should return "review_all" when configured', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: { agentMode: 'review_all' },
      });
      const mode = await service.getAgentMode('app-1');
      expect(mode).toBe('review_all');
    });

    it('should return "auto" for unknown mode values', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: { agentMode: 'invalid' },
      });
      const mode = await service.getAgentMode('app-1');
      expect(mode).toBe('auto');
    });
  });

  describe('shouldWaitForReview', () => {
    it('should return false in auto mode', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue(null);
      expect(await service.shouldWaitForReview('app-1', 'plan')).toBe(false);
      expect(await service.shouldWaitForReview('app-1', 'code')).toBe(false);
    });

    it('should return true for plan phase in review_plan mode', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: { agentMode: 'review_plan' },
      });
      expect(await service.shouldWaitForReview('app-1', 'plan')).toBe(true);
    });

    it('should return false for code phase in review_plan mode', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: { agentMode: 'review_plan' },
      });
      expect(await service.shouldWaitForReview('app-1', 'code')).toBe(false);
    });

    it('should return true for both phases in review_all mode', async () => {
      prisma.projectGithubConfig.findUnique.mockResolvedValue({
        settings: { agentMode: 'review_all' },
      });
      expect(await service.shouldWaitForReview('app-1', 'plan')).toBe(true);
      expect(await service.shouldWaitForReview('app-1', 'code')).toBe(true);
    });
  });

  describe('requestReview', () => {
    it('should set plan_pending_review status for plan phase', async () => {
      prisma.agentTask.findUnique.mockResolvedValue({ id: 'task-1' });
      prisma.agentTask.update.mockResolvedValue({});

      await service.requestReview('task-1', 'plan');

      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'plan_pending_review',
          reviewRequestedAt: expect.any(Date),
        },
      });
    });

    it('should set code_pending_review status for code phase', async () => {
      prisma.agentTask.findUnique.mockResolvedValue({ id: 'task-1' });
      prisma.agentTask.update.mockResolvedValue({});

      await service.requestReview('task-1', 'code');

      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'code_pending_review',
          reviewRequestedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      prisma.agentTask.findUnique.mockResolvedValue(null);
      await expect(service.requestReview('bad-id', 'plan')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approveTask', () => {
    const tenantId = 'tenant-1';

    it('should approve plan from plan_pending_review', async () => {
      prisma.agentTask.findFirst.mockResolvedValue({
        id: 'task-1',
        tenantId,
        status: 'plan_pending_review',
      });
      prisma.agentTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'plan_approved',
      });

      const result = await service.approveTask('task-1', tenantId, 'plan', 'user-1');

      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'plan_approved',
          reviewedAt: expect.any(Date),
          reviewedBy: 'user-1',
        },
      });
      expect(result.status).toBe('plan_approved');
    });

    it('should approve plan from plan_ready (backward compat)', async () => {
      prisma.agentTask.findFirst.mockResolvedValue({
        id: 'task-1',
        tenantId,
        status: 'plan_ready',
      });
      prisma.agentTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'plan_approved',
      });

      await service.approveTask('task-1', tenantId, 'plan', 'user-1');
      expect(prisma.agentTask.update).toHaveBeenCalled();
    });

    it('should approve code from code_pending_review', async () => {
      prisma.agentTask.findFirst.mockResolvedValue({
        id: 'task-1',
        tenantId,
        status: 'code_pending_review',
      });
      prisma.agentTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'code_approved',
      });

      const result = await service.approveTask('task-1', tenantId, 'code', 'user-1');

      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'code_approved',
          reviewedAt: expect.any(Date),
          reviewedBy: 'user-1',
        },
      });
      expect(result.status).toBe('code_approved');
    });

    it('should throw BadRequestException for invalid status', async () => {
      prisma.agentTask.findFirst.mockResolvedValue({
        id: 'task-1',
        tenantId,
        status: 'analyzing',
      });

      await expect(
        service.approveTask('task-1', tenantId, 'plan', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for wrong tenant', async () => {
      prisma.agentTask.findFirst.mockResolvedValue(null);

      await expect(
        service.approveTask('task-1', 'other-tenant', 'plan', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectTask', () => {
    const tenantId = 'tenant-1';

    it('should reject with reason', async () => {
      prisma.agentTask.findFirst.mockResolvedValue({
        id: 'task-1',
        tenantId,
        status: 'plan_pending_review',
      });
      prisma.agentTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
      });

      await service.rejectTask('task-1', tenantId, 'plan', 'user-1', 'Needs changes');

      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: {
          status: 'failed',
          error: 'Needs changes',
          reviewedAt: expect.any(Date),
          reviewedBy: 'user-1',
          rejectionReason: 'Needs changes',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should reject without reason', async () => {
      prisma.agentTask.findFirst.mockResolvedValue({
        id: 'task-1',
        tenantId,
        status: 'code_pending_review',
      });
      prisma.agentTask.update.mockResolvedValue({
        id: 'task-1',
        status: 'failed',
      });

      await service.rejectTask('task-1', tenantId, 'code', 'user-1');

      expect(prisma.agentTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'failed',
          error: 'code rejected by reviewer',
        }),
      });
    });
  });

  describe('expireStaleReviews', () => {
    it('should expire stale tasks older than 24h', async () => {
      const staleTask = {
        id: 'task-1',
        status: 'plan_pending_review',
        reviewRequestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      };
      prisma.agentTask.findMany.mockResolvedValue([staleTask]);
      prisma.agentTask.updateMany.mockResolvedValue({ count: 1 });

      const count = await service.expireStaleReviews();

      expect(count).toBe(1);
      expect(prisma.agentTask.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['task-1'] } },
        data: {
          status: 'expired',
          error: 'Review request expired after 24 hours',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should return 0 when no stale tasks', async () => {
      prisma.agentTask.findMany.mockResolvedValue([]);

      const count = await service.expireStaleReviews();

      expect(count).toBe(0);
      expect(prisma.agentTask.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('listPendingReviews', () => {
    it('should return tasks in pending review status', async () => {
      const tasks = [
        {
          id: 'task-1',
          status: 'plan_pending_review',
          ticket: { id: 't1', title: 'Bug' },
          application: { id: 'a1', name: 'App' },
        },
      ];
      prisma.agentTask.findMany.mockResolvedValue(tasks);

      const result = await service.listPendingReviews('tenant-1');

      expect(result).toEqual(tasks);
      expect(prisma.agentTask.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          status: { in: ['plan_pending_review', 'code_pending_review'] },
        },
        include: expect.any(Object),
        orderBy: { reviewRequestedAt: 'asc' },
      });
    });
  });
});
