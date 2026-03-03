'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Check, ArrowRight, X } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

interface Tier {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: string[];
  notIncluded?: string[];
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    description: 'Try AI-powered bug resolution on your side project. No credit card required.',
    cta: 'Start Free',
    ctaHref: `${DASHBOARD_URL}/signup`,
    featured: false,
    features: [
      '5 AI analyses/month',
      'Gemini Flash model',
      'Video capture & analysis',
      '1 application',
      'Community support',
    ],
    notIncluded: ['Deep code analysis', 'Auto-fix PRs', 'Integrations'],
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/month',
    description: 'For teams that ship fast and need unlimited AI-powered bug resolution.',
    cta: 'Start 14-day Trial',
    ctaHref: `${DASHBOARD_URL}/signup?plan=pro`,
    featured: true,
    features: [
      'Unlimited analyses (BYOK)',
      'Choose your AI model (GPT-4, Claude, Gemini)',
      'Video capture & analysis',
      'Deep code investigation',
      'Auto-fix PR generation',
      'Unlimited applications',
      'GitHub, Jira, Slack, Notion integrations',
      'Email & chat support',
    ],
  },
  {
    name: 'Enterprise',
    price: '$249',
    period: '/month',
    description: 'For organizations needing SSO, dedicated AI infrastructure, and premium SLA.',
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@supporthelper.io',
    featured: false,
    features: [
      'Unlimited analyses',
      'Dedicated AI infrastructure',
      'Everything in Pro',
      'SSO / SAML authentication',
      'Dedicated account manager',
      'Custom integrations & webhooks',
      'Priority support & 99.9% SLA',
      'Audit logs & compliance',
    ],
  },
];

export function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.pricing-card', {
        opacity: 0,
        y: 50,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="pricing" className="relative bg-[#030712] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Simple,{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              transparent
            </span>{' '}
            pricing
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start free. Scale as you grow. No surprise charges.
          </p>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`pricing-card relative flex flex-col overflow-hidden rounded-2xl border p-8 transition-all duration-300 ${
                tier.featured
                  ? 'border-blue-500/30 bg-gradient-to-b from-blue-500/10 to-violet-500/5 shadow-lg shadow-blue-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10'
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              )}

              {tier.featured && (
                <div className="mb-4 inline-flex w-fit items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                <span className="text-sm text-slate-400">{tier.period}</span>
              </div>
              <p className="mt-3 text-sm text-slate-400">{tier.description}</p>

              <a
                href={tier.ctaHref}
                className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
                  tier.featured
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30'
                    : 'border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4" />
              </a>

              <div className="mt-8 border-t border-white/5 pt-6">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                  {tier.notIncluded?.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* BYOK note */}
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-400">BYOK</span> = Bring Your Own Key.
            Connect your own AI API key — your data goes directly to your chosen provider.
            AI costs are billed by the provider at their standard rates.
          </p>
        </div>
      </div>
    </section>
  );
}
