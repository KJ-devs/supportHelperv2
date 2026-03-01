import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, X, ArrowRight, HelpCircle } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, transparent pricing. Start free with 10 AI analyses per month. Upgrade to Pro or Enterprise as you grow.',
};

type FeatureValue = boolean | string;

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: Record<string, FeatureValue>;
}

const TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for side projects and trying out AI-powered bug resolution.',
    cta: 'Start Free',
    ctaHref: `${DASHBOARD_URL}/signup`,
    featured: false,
    features: {
      'AI Analyses': '10/month',
      'AI Model': 'Gemini Flash',
      'Video Analysis': true,
      'Deep Code Analysis': false,
      'Auto-fix PRs': false,
      'SSO / SAML': false,
      'Support': 'Community',
      'Custom Integrations': false,
      'Dedicated Account Manager': false,
    },
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For professional teams that need unlimited analyses and their own AI key.',
    cta: 'Start Trial',
    ctaHref: `${DASHBOARD_URL}/signup?plan=pro`,
    featured: true,
    features: {
      'AI Analyses': 'Unlimited (BYOK)',
      'AI Model': 'Your choice (BYOK)',
      'Video Analysis': true,
      'Deep Code Analysis': true,
      'Auto-fix PRs': true,
      'SSO / SAML': false,
      'Support': 'Email',
      'Custom Integrations': true,
      'Dedicated Account Manager': false,
    },
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/month',
    description: 'For large organizations needing SSO, dedicated AI, and premium support.',
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@supporthelper.io',
    featured: false,
    features: {
      'AI Analyses': 'Unlimited',
      'AI Model': 'Dedicated',
      'Video Analysis': true,
      'Deep Code Analysis': true,
      'Auto-fix PRs': true,
      'SSO / SAML': true,
      'Support': 'Dedicated',
      'Custom Integrations': true,
      'Dedicated Account Manager': true,
    },
  },
];

const FEATURE_ROWS = [
  'AI Analyses',
  'AI Model',
  'Video Analysis',
  'Deep Code Analysis',
  'Auto-fix PRs',
  'SSO / SAML',
  'Support',
  'Custom Integrations',
  'Dedicated Account Manager',
];

const FAQ = [
  {
    question: 'What is BYOK (Bring Your Own Key)?',
    answer:
      'BYOK lets you connect your own API key from AI providers like Anthropic, OpenAI, or Google Gemini. Your data goes directly to your chosen provider — we never see your prompts or results. This also means your AI costs are billed directly by the provider at their standard rates.',
  },
  {
    question: 'How does the free tier work?',
    answer:
      'The free tier gives you 10 AI analyses per month at no cost. Analyses use Gemini Flash, a fast and capable model. When you hit the limit, you can upgrade to Pro with your own API key for unlimited analyses.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period. No lock-in, no cancellation fees.',
  },
  {
    question: 'Is my AI API key secure?',
    answer:
      'Your API keys are encrypted at rest using AES-256-GCM before being stored in our database. Keys are decrypted only in memory at analysis time and are never logged. You can revoke or rotate your key at any time from your settings.',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'We support Anthropic Claude, OpenAI GPT-4, Google Gemini, AWS Bedrock (Claude and Titan), and self-hosted models via Ollama. You can configure different models for different tasks — e.g., a fast model for triage and a powerful model for deep analysis.',
  },
];

function FeatureCell({ value }: { value: FeatureValue }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-green-500" aria-label="Included" />
    ) : (
      <X className="mx-auto h-5 w-5 text-muted-foreground/40" aria-label="Not included" />
    );
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-b from-background to-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Scale as you grow. No surprise charges.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
                  tier.featured
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="inline-flex items-center rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow">
                      Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-semibold text-foreground">{tier.name}</h2>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{tier.description}</p>
                </div>

                <a
                  href={tier.ctaHref}
                  className={`mt-8 inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    tier.featured
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {tier.cta}
                  <ArrowRight className="h-4 w-4" />
                </a>

                <ul className="mt-8 space-y-3">
                  {FEATURE_ROWS.filter((f) => tier.features[f] !== false).map((feature) => {
                    const value = tier.features[feature];
                    return (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                        <span className="text-sm text-muted-foreground">
                          {typeof value === 'string' ? (
                            <>
                              <span className="font-medium text-foreground">{value}</span>{' '}
                              {feature}
                            </>
                          ) : (
                            feature
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">
            Full feature comparison
          </h2>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Feature
                  </th>
                  {TIERS.map((tier) => (
                    <th
                      key={tier.name}
                      className={`px-4 py-4 text-center text-sm font-semibold ${
                        tier.featured ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {tier.name}
                      {tier.featured && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Popular
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((feature, idx) => (
                  <tr
                    key={feature}
                    className={`border-b border-border last:border-0 ${
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    }`}
                  >
                    <td className="px-6 py-3 font-medium text-foreground">{feature}</td>
                    {TIERS.map((tier) => (
                      <td key={tier.name} className="px-4 py-3 text-center">
                        <FeatureCell value={tier.features[feature]} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-muted/30">
                  <td className="px-6 py-4 font-semibold text-foreground">Monthly price</td>
                  {TIERS.map((tier) => (
                    <td key={tier.name} className="px-4 py-4 text-center">
                      <span
                        className={`text-lg font-bold ${
                          tier.featured ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {tier.price}
                      </span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </td>
                  ))}
                </tr>
                <tr className="bg-background">
                  <td className="px-6 py-4" />
                  {TIERS.map((tier) => (
                    <td key={tier.name} className="px-4 py-4 text-center">
                      <a
                        href={tier.ctaHref}
                        className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors ${
                          tier.featured
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-border bg-background text-foreground hover:bg-accent'
                        }`}
                      >
                        {tier.cta}
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-muted/30 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-4 flex justify-center">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground sm:text-3xl">
            Frequently asked questions
          </h2>

          <div className="space-y-6">
            {FAQ.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <h3 className="font-semibold text-foreground">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Have more questions?{' '}
              <a
                href="mailto:hello@supporthelper.io"
                className="font-medium text-primary hover:underline"
              >
                Contact our team
              </a>{' '}
              — we&apos;re happy to help.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground">
            Ready to get started?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Join teams already resolving bugs faster with AI.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-primary shadow transition-colors hover:bg-white/90"
            >
              Start for Free
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-white/30 px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
