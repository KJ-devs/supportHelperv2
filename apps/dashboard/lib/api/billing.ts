/**
 * Billing API Client
 * Handles Stripe Checkout, Customer Portal, and subscription status.
 */

import { apiRequest } from './client';

export interface SubscriptionStatus {
  plan: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * Get current subscription status for the authenticated tenant.
 */
export async function getSubscription(): Promise<SubscriptionStatus> {
  return apiRequest<SubscriptionStatus>('/api/billing/subscription');
}

/**
 * Create a Stripe Checkout session for a plan upgrade.
 * Returns the Stripe-hosted checkout URL.
 */
export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  return apiRequest<{ url: string }>('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ priceId }),
  });
}

/**
 * Create a Stripe Customer Portal session for self-service billing management.
 * Returns the Stripe-hosted portal URL.
 */
export async function createPortalSession(): Promise<{ url: string }> {
  return apiRequest<{ url: string }>('/api/billing/portal', {
    method: 'POST',
  });
}
