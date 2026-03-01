import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../../../src/modules/billing/billing.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Mock the entire Stripe module before imports take effect
jest.mock('stripe', () => {
  const mockStripe = {
    customers: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    subscriptions: {
      list: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };
  return jest.fn(() => mockStripe);
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require('stripe');

describe('BillingService', () => {
  let service: BillingService;
  let prisma: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let mockStripeInstance: ReturnType<typeof Stripe>;

  const mockTenantId = 'tenant-uuid-123';
  const mockCustomerId = 'cus_stripe123';
  const mockProPriceId = 'price_pro_123';
  const mockEnterprisePriceId = 'price_enterprise_123';

  const mockTenant = {
    id: mockTenantId,
    name: 'Test Tenant',
    stripeCustomerId: null as string | null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStripeInstance = new Stripe();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                STRIPE_SECRET_KEY: 'sk_test_123',
                STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
                STRIPE_PRICE_PRO: mockProPriceId,
                STRIPE_PRICE_ENTERPRISE: mockEnterprisePriceId,
                DASHBOARD_URL: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            tenantQuota: {
              upsert: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    // Make $transaction execute the provided array of promises
    (prisma.$transaction as jest.Mock).mockImplementation(
      (ops: Promise<unknown>[]) => Promise.all(ops),
    );
  });

  // ─── getOrCreateCustomer ─────────────────────────────────────────────────

  describe('getOrCreateCustomer', () => {
    it('should return existing stripeCustomerId if already set', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: mockCustomerId,
      });

      const result = await service.getOrCreateCustomer(mockTenantId);

      expect(result).toBe(mockCustomerId);
      expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
    });

    it('should create a new Stripe customer and persist its ID', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: null,
      });
      mockStripeInstance.customers.create.mockResolvedValue({ id: mockCustomerId });
      (prisma.tenant.update as jest.Mock).mockResolvedValue({});

      const result = await service.getOrCreateCustomer(mockTenantId);

      expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
        name: mockTenant.name,
        metadata: { tenantId: mockTenantId },
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: mockTenantId },
        data: { stripeCustomerId: mockCustomerId },
      });
      expect(result).toBe(mockCustomerId);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getOrCreateCustomer(mockTenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── createCheckoutSession ───────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    beforeEach(() => {
      // Stub getOrCreateCustomer via tenant lookup
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: mockCustomerId,
      });
    });

    it('should create a checkout session and return the URL', async () => {
      const mockUrl = 'https://checkout.stripe.com/session/abc123';
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({ url: mockUrl, id: 'cs_123' });

      const result = await service.createCheckoutSession(mockTenantId, mockProPriceId);

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: mockCustomerId,
          mode: 'subscription',
          line_items: [{ price: mockProPriceId, quantity: 1 }],
          metadata: { tenantId: mockTenantId },
        }),
      );
      expect(result).toEqual({ url: mockUrl });
    });

    it('should throw BadRequestException for unknown priceId', async () => {
      await expect(
        service.createCheckoutSession(mockTenantId, 'price_unknown'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty priceId', async () => {
      await expect(service.createCheckoutSession(mockTenantId, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when Stripe does not return a URL', async () => {
      mockStripeInstance.checkout.sessions.create.mockResolvedValue({ url: null, id: 'cs_123' });

      await expect(
        service.createCheckoutSession(mockTenantId, mockProPriceId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── createPortalSession ─────────────────────────────────────────────────

  describe('createPortalSession', () => {
    it('should create a portal session and return the URL', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: mockCustomerId,
      });
      const mockPortalUrl = 'https://billing.stripe.com/portal/session/xyz';
      mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
        url: mockPortalUrl,
        id: 'bps_123',
      });

      const result = await service.createPortalSession(mockTenantId);

      expect(mockStripeInstance.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        return_url: 'http://localhost:3000/dashboard/settings/billing',
      });
      expect(result).toEqual({ url: mockPortalUrl });
    });

    it('should throw BadRequestException when tenant has no Stripe customer', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: null,
      });

      await expect(service.createPortalSession(mockTenantId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getSubscription ────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('should return plan with null subscription fields when no Stripe customer', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        plan: 'free',
        stripeCustomerId: null,
      });

      const result = await service.getSubscription(mockTenantId);

      expect(result).toEqual({
        plan: 'free',
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
    });

    it('should return active subscription details', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        plan: 'pro',
        stripeCustomerId: mockCustomerId,
      });

      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
      mockStripeInstance.subscriptions.list.mockResolvedValue({
        data: [
          {
            id: 'sub_123',
            status: 'active',
            current_period_end: periodEnd,
            cancel_at_period_end: false,
          },
        ],
      });

      const result = await service.getSubscription(mockTenantId);

      expect(result.plan).toBe('pro');
      expect(result.status).toBe('active');
      expect(result.stripeSubscriptionId).toBe('sub_123');
      expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getSubscription(mockTenantId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── handleCheckoutCompleted ────────────────────────────────────────────

  describe('handleCheckoutCompleted', () => {
    const mockSession = {
      id: 'cs_123',
      metadata: { tenantId: mockTenantId },
      subscription: 'sub_123',
      customer: mockCustomerId,
    } as unknown;

    it('should upgrade the tenant to pro plan when checkout completes', async () => {
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ price: { id: mockProPriceId } }] },
      });

      // Stub the transaction ops
      (prisma.tenant.update as jest.Mock).mockResolvedValue({});
      (prisma.tenantQuota.upsert as jest.Mock).mockResolvedValue({});

      await service.handleCheckoutCompleted(mockSession as import('stripe').Stripe.Checkout.Session);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTenantId },
          data: expect.objectContaining({ plan: 'pro' }),
        }),
      );
    });

    it('should do nothing when tenantId is missing from metadata', async () => {
      const sessionWithoutTenant = { ...mockSession, metadata: {} } as unknown;

      await service.handleCheckoutCompleted(
        sessionWithoutTenant as import('stripe').Stripe.Checkout.Session,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── handleSubscriptionDeleted ──────────────────────────────────────────

  describe('handleSubscriptionDeleted', () => {
    const mockSubscription = {
      id: 'sub_123',
      customer: mockCustomerId,
      items: { data: [{ price: { id: mockProPriceId } }] },
    } as unknown;

    it('should downgrade tenant to free plan when subscription is deleted', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: mockTenantId });
      (prisma.tenant.update as jest.Mock).mockResolvedValue({});
      (prisma.tenantQuota.upsert as jest.Mock).mockResolvedValue({});

      await service.handleSubscriptionDeleted(
        mockSubscription as import('stripe').Stripe.Subscription,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'free' }),
        }),
      );
    });

    it('should do nothing when no tenant matches the customer ID', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue(null);

      await service.handleSubscriptionDeleted(
        mockSubscription as import('stripe').Stripe.Subscription,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── handleSubscriptionUpdated ──────────────────────────────────────────

  describe('handleSubscriptionUpdated', () => {
    const makeSubscription = (priceId: string, status = 'active') => ({
      id: 'sub_123',
      customer: mockCustomerId,
      status,
      items: { data: [{ price: { id: priceId } }] },
    });

    it('should update tenant to enterprise plan', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: mockTenantId });
      (prisma.tenant.update as jest.Mock).mockResolvedValue({});
      (prisma.tenantQuota.upsert as jest.Mock).mockResolvedValue({});

      await service.handleSubscriptionUpdated(
        makeSubscription(mockEnterprisePriceId) as unknown as import('stripe').Stripe.Subscription,
      );

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'enterprise' }),
        }),
      );
    });

    it('should not update plan when subscription status is past_due', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: mockTenantId });

      await service.handleSubscriptionUpdated(
        makeSubscription(mockProPriceId, 'past_due') as unknown as import('stripe').Stripe.Subscription,
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── constructWebhookEvent ──────────────────────────────────────────────

  describe('constructWebhookEvent', () => {
    it('should call stripe.webhooks.constructEvent with correct args', () => {
      const rawBody = Buffer.from('{}');
      const sig = 't=123,v1=abc';
      const mockEvent = { type: 'checkout.session.completed', id: 'evt_1' };
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = service.constructWebhookEvent(rawBody, sig);

      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        sig,
        'whsec_test_123',
      );
      expect(result).toBe(mockEvent);
    });
  });
});
