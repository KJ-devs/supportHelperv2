import { Test, TestingModule } from '@nestjs/testing';
import { QuotaService } from '../../../src/modules/ai-config/quota.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Helper to build a mock TenantQuota object
function makeQuota(overrides: Partial<{
  id: string;
  tenantId: string;
  plan: string;
  monthlyQuota: number;
  currentUsage: number;
  quotaResetAt: Date;
  isByok: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 'quota-id',
    tenantId: 'tenant-id',
    plan: 'free',
    monthlyQuota: 10,
    currentUsage: 0,
    quotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // future
    isByok: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('QuotaService', () => {
  let service: QuotaService;

  const mockPrisma = {
    tenantQuota: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<QuotaService>(QuotaService);

    jest.clearAllMocks();
  });

  // ─── ensureQuotaExists ────────────────────────────────────────────────────

  describe('ensureQuotaExists', () => {
    it('returns existing quota without creating a new one', async () => {
      const quota = makeQuota();
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const result = await service.ensureQuotaExists('tenant-id');

      expect(result).toEqual(quota);
      expect(mockPrisma.tenantQuota.create).not.toHaveBeenCalled();
    });

    it('lazily creates a free-tier quota when none exists', async () => {
      const created = makeQuota();
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(null);
      mockPrisma.tenantQuota.create.mockResolvedValue(created);

      const result = await service.ensureQuotaExists('tenant-id');

      expect(result).toEqual(created);
      expect(mockPrisma.tenantQuota.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-id',
            plan: 'free',
            monthlyQuota: 10,
            currentUsage: 0,
            isByok: false,
          }),
        }),
      );
    });
  });

  // ─── checkQuota ───────────────────────────────────────────────────────────

  describe('checkQuota', () => {
    it('allows access when quota is not reached', async () => {
      const quota = makeQuota({ currentUsage: 5, monthlyQuota: 10 });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const result = await service.checkQuota('tenant-id');

      expect(result).toEqual({ allowed: true });
    });

    it('denies access when usage equals quota', async () => {
      const quota = makeQuota({ currentUsage: 10, monthlyQuota: 10 });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const result = await service.checkQuota('tenant-id');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Monthly AI analysis quota exceeded');
      expect(result.reason).toContain('10/10');
    });

    it('denies access when usage exceeds quota', async () => {
      const quota = makeQuota({ currentUsage: 15, monthlyQuota: 10 });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const result = await service.checkQuota('tenant-id');

      expect(result.allowed).toBe(false);
    });

    it('always allows BYOK tenants regardless of usage', async () => {
      const quota = makeQuota({
        currentUsage: 999,
        monthlyQuota: 10,
        isByok: true,
      });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const result = await service.checkQuota('tenant-id');

      expect(result).toEqual({ allowed: true });
    });

    it('auto-resets quota when quotaResetAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second in the past
      const expiredQuota = makeQuota({
        currentUsage: 8,
        monthlyQuota: 10,
        quotaResetAt: pastDate,
      });
      const resetQuota = makeQuota({
        currentUsage: 0,
        monthlyQuota: 10,
        quotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // First call returns expired quota (ensureQuotaExists)
      // Second call returns updated quota (after resetQuotaIfNeeded's findUnique)
      // Third call returns reset quota (the refresh findUnique)
      mockPrisma.tenantQuota.findUnique
        .mockResolvedValueOnce(expiredQuota) // ensureQuotaExists
        .mockResolvedValueOnce(expiredQuota) // resetQuotaIfNeeded inner findUnique
        .mockResolvedValueOnce(resetQuota);  // refresh after reset

      mockPrisma.tenantQuota.update.mockResolvedValue(resetQuota);

      const result = await service.checkQuota('tenant-id');

      expect(mockPrisma.tenantQuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-id' },
          data: expect.objectContaining({
            currentUsage: 0,
          }),
        }),
      );
      expect(result).toEqual({ allowed: true });
    });
  });

  // ─── incrementUsage ───────────────────────────────────────────────────────

  describe('incrementUsage', () => {
    it('increments the current usage by 1', async () => {
      const quota = makeQuota({ currentUsage: 3 });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);
      mockPrisma.tenantQuota.update.mockResolvedValue({ ...quota, currentUsage: 4 });

      await service.incrementUsage('tenant-id');

      expect(mockPrisma.tenantQuota.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-id' },
        data: { currentUsage: { increment: 1 } },
      });
    });

    it('creates quota record first if it does not exist, then increments', async () => {
      const created = makeQuota({ currentUsage: 0 });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(null);
      mockPrisma.tenantQuota.create.mockResolvedValue(created);
      mockPrisma.tenantQuota.update.mockResolvedValue({ ...created, currentUsage: 1 });

      await service.incrementUsage('tenant-id');

      expect(mockPrisma.tenantQuota.create).toHaveBeenCalled();
      expect(mockPrisma.tenantQuota.update).toHaveBeenCalled();
    });
  });

  // ─── getQuotaStatus ───────────────────────────────────────────────────────

  describe('getQuotaStatus', () => {
    it('returns correct quota status for a standard tenant', async () => {
      const quota = makeQuota({ currentUsage: 3, monthlyQuota: 10 });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const status = await service.getQuotaStatus('tenant-id');

      expect(status).toMatchObject({
        plan: 'free',
        monthlyQuota: 10,
        currentUsage: 3,
        remaining: 7,
        isByok: false,
      });
      expect(status.resetsAt).toBeInstanceOf(Date);
    });

    it('returns remaining=-1 for BYOK tenants (unlimited)', async () => {
      const quota = makeQuota({
        currentUsage: 500,
        monthlyQuota: 10,
        isByok: true,
        plan: 'enterprise',
      });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      const status = await service.getQuotaStatus('tenant-id');

      expect(status.isByok).toBe(true);
      expect(status.remaining).toBe(-1);
    });
  });

  // ─── resetQuotaIfNeeded ───────────────────────────────────────────────────

  describe('resetQuotaIfNeeded', () => {
    it('does nothing when quota record does not exist', async () => {
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(null);

      await service.resetQuotaIfNeeded('tenant-id');

      expect(mockPrisma.tenantQuota.update).not.toHaveBeenCalled();
    });

    it('does nothing when quota reset date is in the future', async () => {
      const quota = makeQuota({
        quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);

      await service.resetQuotaIfNeeded('tenant-id');

      expect(mockPrisma.tenantQuota.update).not.toHaveBeenCalled();
    });

    it('resets usage when quota reset date has passed', async () => {
      const quota = makeQuota({
        currentUsage: 8,
        quotaResetAt: new Date(Date.now() - 1000),
      });
      mockPrisma.tenantQuota.findUnique.mockResolvedValue(quota);
      mockPrisma.tenantQuota.update.mockResolvedValue({ ...quota, currentUsage: 0 });

      await service.resetQuotaIfNeeded('tenant-id');

      expect(mockPrisma.tenantQuota.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-id' },
          data: expect.objectContaining({
            currentUsage: 0,
          }),
        }),
      );
    });
  });
});
