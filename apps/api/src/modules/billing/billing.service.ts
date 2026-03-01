import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';

export interface SubscriptionStatus {
  plan: string;
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * BillingService — manages Stripe Checkout, Customer Portal, and webhook events.
 *
 * Price ID → plan mapping uses env vars:
 *   STRIPE_PRICE_PRO       → 'pro'
 *   STRIPE_PRICE_ENTERPRISE → 'enterprise'
 *
 * On downgrade / cancellation, the tenant is moved to 'free' and TenantQuota is updated.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-02-25.clover',
    });
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Map a Stripe price ID to a plan name using env config.
   */
  private getPlanForPriceId(priceId: string): 'pro' | 'enterprise' | null {
    const proPriceId = this.configService.get<string>('STRIPE_PRICE_PRO');
    const enterprisePriceId = this.configService.get<string>('STRIPE_PRICE_ENTERPRISE');

    if (priceId === proPriceId) return 'pro';
    if (priceId === enterprisePriceId) return 'enterprise';
    return null;
  }

  /**
   * Quota limits per plan — mirrors TenantQuota defaults.
   */
  private getMonthlyQuotaForPlan(plan: string): number {
    const quotas: Record<string, number> = {
      free: 10,
      pro: 100,
      enterprise: 1000,
    };
    return quotas[plan] ?? 10;
  }

  /**
   * Update plan on tenant and TenantQuota in a single transaction.
   */
  private async updateTenantPlan(
    tenantId: string,
    plan: string,
    stripeCustomerId?: string,
  ): Promise<void> {
    const monthlyQuota = this.getMonthlyQuotaForPlan(plan);

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plan,
          ...(stripeCustomerId ? { stripeCustomerId } : {}),
        },
      }),
      this.prisma.tenantQuota.upsert({
        where: { tenantId },
        update: { plan, monthlyQuota },
        create: {
          tenantId,
          plan,
          monthlyQuota,
          quotaResetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Retrieve the Stripe customer ID for a tenant, creating one if needed.
   */
  async getOrCreateCustomer(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.stripeCustomerId) {
      return tenant.stripeCustomerId;
    }

    // Create a new Stripe customer
    const customer = await this.stripe.customers.create({
      name: tenant.name,
      metadata: { tenantId },
    });

    // Persist the customer ID
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customer.id },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for tenant ${tenantId}`);
    return customer.id;
  }

  /**
   * Create a Stripe Checkout session for a plan upgrade.
   */
  async createCheckoutSession(
    tenantId: string,
    priceId: string,
  ): Promise<{ url: string }> {
    if (!priceId || priceId.trim() === '') {
      throw new BadRequestException('priceId is required');
    }

    const plan = this.getPlanForPriceId(priceId);
    if (!plan) {
      throw new BadRequestException(`Unknown priceId: ${priceId}`);
    }

    const customerId = await this.getOrCreateCustomer(tenantId);
    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL') || 'http://localhost:3000';

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${dashboardUrl}/dashboard/settings/billing?success=true`,
      cancel_url: `${dashboardUrl}/dashboard/settings/billing?canceled=true`,
      metadata: { tenantId },
    });

    if (!session.url) {
      throw new BadRequestException('Failed to create Stripe Checkout session URL');
    }

    return { url: session.url };
  }

  /**
   * Create a Stripe Customer Portal session for self-service billing management.
   */
  async createPortalSession(tenantId: string): Promise<{ url: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer found for this tenant. Please subscribe to a plan first.',
      );
    }

    const dashboardUrl = this.configService.get<string>('DASHBOARD_URL') || 'http://localhost:3000';

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${dashboardUrl}/dashboard/settings/billing`,
    });

    return { url: session.url };
  }

  /**
   * Get the current subscription status for a tenant.
   */
  async getSubscription(tenantId: string): Promise<SubscriptionStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, stripeCustomerId: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // If no Stripe customer, return the current plan with no subscription details
    if (!tenant.stripeCustomerId) {
      return {
        plan: tenant.plan,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
    }

    // Fetch active subscriptions from Stripe
    const subscriptions = await this.stripe.subscriptions.list({
      customer: tenant.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    const subscription = subscriptions.data[0];

    if (!subscription) {
      // Check for trials or other statuses
      const allSubscriptions = await this.stripe.subscriptions.list({
        customer: tenant.stripeCustomerId,
        limit: 1,
      });
      const anySubscription = allSubscriptions.data[0];

      return {
        plan: tenant.plan,
        status: anySubscription?.status ?? null,
        currentPeriodEnd: anySubscription
          ? new Date(anySubscription.billing_cycle_anchor * 1000)
          : null,
        cancelAtPeriodEnd: anySubscription?.cancel_at_period_end ?? false,
        stripeCustomerId: tenant.stripeCustomerId,
        stripeSubscriptionId: anySubscription?.id ?? null,
      };
    }

    return {
      plan: tenant.plan,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.billing_cycle_anchor * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: tenant.stripeCustomerId,
      stripeSubscriptionId: subscription.id,
    };
  }

  // ─── Webhook handlers ─────────────────────────────────────────────────────

  /**
   * Handle checkout.session.completed — activate the subscribed plan.
   */
  async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) {
      this.logger.warn('checkout.session.completed: missing tenantId in metadata');
      return;
    }

    // Retrieve the full subscription to get the price ID
    if (!session.subscription) {
      this.logger.warn(`checkout.session.completed: no subscription on session ${session.id}`);
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      this.logger.warn(`checkout.session.completed: no price found on subscription ${subscription.id}`);
      return;
    }

    const plan = this.getPlanForPriceId(priceId);
    if (!plan) {
      this.logger.warn(`checkout.session.completed: unknown priceId ${priceId}`);
      return;
    }

    const customerId = typeof session.customer === 'string'
      ? session.customer
      : (session.customer as Stripe.Customer | null)?.id ?? undefined;

    await this.updateTenantPlan(tenantId, plan, customerId);
    this.logger.log(`Tenant ${tenantId} upgraded to ${plan} plan (subscription ${subscription.id})`);
  }

  /**
   * Handle customer.subscription.updated — sync plan changes.
   */
  async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (!tenant) {
      this.logger.warn(`subscription.updated: no tenant for customer ${customerId}`);
      return;
    }

    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      this.logger.warn(`subscription.updated: no price found on subscription ${subscription.id}`);
      return;
    }

    const plan = this.getPlanForPriceId(priceId);
    if (!plan) {
      this.logger.warn(`subscription.updated: unknown priceId ${priceId}`);
      return;
    }

    // Only update if the subscription is active (not cancelled/past-due)
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      await this.updateTenantPlan(tenant.id, plan);
      this.logger.log(`Tenant ${tenant.id} plan updated to ${plan}`);
    }
  }

  /**
   * Handle customer.subscription.deleted — downgrade to free tier.
   */
  async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });

    if (!tenant) {
      this.logger.warn(`subscription.deleted: no tenant for customer ${customerId}`);
      return;
    }

    await this.updateTenantPlan(tenant.id, 'free');
    this.logger.log(`Tenant ${tenant.id} downgraded to free plan (subscription ${subscription.id} deleted)`);
  }

  /**
   * Handle invoice.payment_failed — log the failure.
   */
  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : (invoice.customer as Stripe.Customer | null)?.id;

    this.logger.warn(
      `Payment failed for customer ${customerId ?? 'unknown'}: invoice ${invoice.id}, amount ${invoice.amount_due}`,
    );
    // Future: send notification email, update UI flags, etc.
  }

  /**
   * Verify and construct a Stripe webhook event from raw request body + signature.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
