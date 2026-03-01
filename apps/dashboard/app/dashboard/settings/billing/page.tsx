/**
 * Billing Settings Page
 * Displays current plan, subscription status, and Stripe Checkout / Portal buttons.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageLoader, Card, Button, Badge } from '@/components/ui';
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
} from '@/lib/api/billing';
import type { SubscriptionStatus } from '@/lib/api/billing';
import { CreditCard, ExternalLink, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    key: 'free',
    price: '$0',
    period: '/month',
    features: ['10 tickets/month', '1 application', 'Basic AI analysis', 'Email support'],
    priceId: null,
    highlight: false,
  },
  {
    name: 'Pro',
    key: 'pro',
    price: '$49',
    period: '/month',
    features: [
      '100 tickets/month',
      'Unlimited applications',
      'Advanced AI analysis',
      'GitHub integration',
      'Priority support',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? null,
    highlight: true,
  },
  {
    name: 'Enterprise',
    key: 'enterprise',
    price: '$199',
    period: '/month',
    features: [
      '1000 tickets/month',
      'Unlimited applications',
      'Deep AI analysis + codebase indexing',
      'SSO / SAML',
      'SLA support',
      'Custom integrations',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE ?? null,
    highlight: false,
  },
];

function getPlanBadgeVariant(plan: string): 'default' | 'success' | 'warning' {
  if (plan === 'enterprise') return 'success';
  if (plan === 'pro') return 'warning';
  return 'default';
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'active' || status === 'trialing') {
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  }
  if (status === 'past_due' || status === 'unpaid') {
    return <AlertTriangle className="w-5 h-5 text-orange-500" />;
  }
  if (status === 'canceled') {
    return <XCircle className="w-5 h-5 text-red-500" />;
  }
  return null;
}

export default function BillingPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const searchParams = useSearchParams();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<string | null>(null);

  const successParam = searchParams.get('success');
  const canceledParam = searchParams.get('canceled');

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSubscription();
      setSubscription(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load billing data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchSubscription();
    }
  }, [authLoading, fetchSubscription]);

  const handleUpgrade = async (priceId: string | null) => {
    if (!priceId) return;
    try {
      setIsRedirecting(priceId);
      const { url } = await createCheckoutSession(priceId);
      window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      setError(message);
      setIsRedirecting(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setIsRedirecting('portal');
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to open billing portal';
      setError(message);
      setIsRedirecting(null);
    }
  };

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  const currentPlan = subscription?.plan ?? 'free';
  const hasActiveSubscription =
    subscription?.status === 'active' || subscription?.status === 'trialing';

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <a
              href="/dashboard/settings"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Settings
            </a>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-sm text-gray-900 dark:text-white font-medium">Billing</span>
          </div>
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your subscription and payment details
              </p>
            </div>
          </div>
        </div>

        {/* Success / Cancel Alerts */}
        {successParam === 'true' && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300">
              Subscription activated successfully. Your plan has been updated.
            </p>
          </div>
        )}
        {canceledParam === 'true' && (
          <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-300">
              Checkout was canceled. No changes have been made.
            </p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            <Button onClick={fetchSubscription} className="mt-2" size="sm" variant="ghost">
              Retry
            </Button>
          </div>
        )}

        {/* Current Plan Card */}
        {subscription && (
          <Card className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Current Plan
                </h2>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                    {currentPlan}
                  </span>
                  <Badge variant={getPlanBadgeVariant(currentPlan)}>
                    {currentPlan.toUpperCase()}
                  </Badge>
                  {subscription.status && (
                    <div className="flex items-center gap-1">
                      <StatusIcon status={subscription.status} />
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {subscription.status}
                      </span>
                    </div>
                  )}
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {subscription.cancelAtPeriodEnd
                      ? 'Cancels on '
                      : 'Renews on '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </div>

              {/* Manage Subscription Button (only if customer exists) */}
              {subscription.stripeCustomerId && (
                <Button
                  onClick={handleManageSubscription}
                  isLoading={isRedirecting === 'portal'}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  Manage Subscription
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Plan Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Available Plans
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              const isUpgrade =
                (currentPlan === 'free' && (plan.key === 'pro' || plan.key === 'enterprise')) ||
                (currentPlan === 'pro' && plan.key === 'enterprise');

              return (
                <div
                  key={plan.key}
                  className={`relative rounded-xl border-2 p-6 flex flex-col ${
                    plan.highlight
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                      : isCurrent
                      ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/10'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  {plan.highlight && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {plan.price}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 text-sm">
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button disabled variant="ghost" className="w-full">
                      Current Plan
                    </Button>
                  ) : isUpgrade && plan.priceId ? (
                    <Button
                      onClick={() => handleUpgrade(plan.priceId)}
                      isLoading={isRedirecting === plan.priceId}
                      className="w-full"
                    >
                      Upgrade to {plan.name}
                    </Button>
                  ) : plan.key === 'free' && hasActiveSubscription ? (
                    <Button
                      onClick={handleManageSubscription}
                      isLoading={isRedirecting === 'portal'}
                      variant="ghost"
                      className="w-full"
                    >
                      Downgrade via Portal
                    </Button>
                  ) : (
                    <Button disabled variant="ghost" className="w-full">
                      Contact Sales
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Footer */}
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Payments are securely processed by{' '}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Stripe
            </a>
            . Subscriptions renew automatically and can be cancelled at any time via the
            billing portal. For enterprise pricing or custom needs,{' '}
            <a
              href="mailto:sales@support-helper.io"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              contact sales
            </a>
            .
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}
