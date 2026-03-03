'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Sparkles } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const tiers = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mo',
    description: 'For individual developers exploring AI-powered bug reporting.',
    cta: 'Get Started Free',
    ctaStyle: 'border border-white/10 text-white hover:border-white/20',
    highlighted: false,
    features: [
      '5 AI analyses per month',
      '1 application',
      'Video capture SDK',
      'Basic AI diagnosis',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    description: 'For teams that want unlimited AI-powered bug resolution.',
    cta: 'Start Pro Trial',
    ctaStyle:
      'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20',
    highlighted: true,
    features: [
      'Unlimited AI analyses',
      'Unlimited applications',
      'BYOK (Bring Your Own Key)',
      'Auto-fix Pull Requests',
      'GitHub, Jira, Slack, Notion',
      'Priority support',
      'Team collaboration',
    ],
  },
  {
    name: 'Enterprise',
    price: '$249',
    period: '/mo',
    description: 'For organizations with advanced security and compliance needs.',
    cta: 'Contact Sales',
    ctaStyle: 'border border-white/10 text-white hover:border-white/20',
    highlighted: false,
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'SSO / SAML',
      'Priority SLA (< 4h)',
      'Custom integrations',
      'Audit logs',
      'Dedicated account manager',
    ],
  },
];

export function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.pricing-card', {
        y: 40,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="relative overflow-hidden bg-[#030712] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wider text-amber-400">
            PRICING
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Start free. Scale as you grow.
          </h2>
          <p className="mt-4 text-base text-slate-400">
            No credit card required. Upgrade when your team is ready.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`pricing-card relative flex flex-col rounded-xl border p-6 ${
                tier.highlighted
                  ? 'border-blue-500/30 bg-gradient-to-b from-blue-500/[0.06] to-transparent'
                  : 'border-white/5 bg-[#0a0f1e]'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1 text-[10px] font-medium text-white shadow-lg">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-sm font-medium text-slate-400">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  <span className="text-sm text-slate-500">{tier.period}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {tier.description}
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      tier.highlighted ? 'text-blue-400' : 'text-slate-600'
                    }`} />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={`${DASHBOARD_URL}/signup`}
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-all ${tier.ctaStyle}`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
