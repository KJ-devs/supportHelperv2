import type { Metadata } from 'next';
import { NavBarDark } from '@/components/landing/nav-bar-dark';
import { HeroTerminal } from '@/components/landing/v1/hero-terminal';
import { LogosV1 } from '@/components/landing/v1/logos-v1';
import { HowItWorksV1 } from '@/components/landing/v1/how-it-works-v1';
import { FeaturesV1 } from '@/components/landing/v1/features-v1';
import { TestimonialsV1 } from '@/components/landing/v1/testimonials-v1';
import { PricingV1 } from '@/components/landing/v1/pricing-v1';
import { FaqV1 } from '@/components/landing/v1/faq-v1';
import { SecurityV1 } from '@/components/landing/v1/security-v1';
import { CtaV1 } from '@/components/landing/v1/cta-v1';
import { FooterDark } from '@/components/landing/footer-dark';

export const metadata: Metadata = {
  title: 'Support Helper — The Pipeline (Developer-First)',
  description:
    'Your users film the bug. Your AI ships the fix. One SDK, zero triage — AI investigates your codebase, finds the root cause, and opens a PR automatically.',
};

export default function LandingV1Page() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      <NavBarDark />
      <main className="flex-1">
        <HeroTerminal />
        <LogosV1 />
        <HowItWorksV1 />
        <FeaturesV1 />
        <TestimonialsV1 />
        <PricingV1 />
        <FaqV1 />
        <SecurityV1 />
        <CtaV1 />
      </main>
      <FooterDark />
    </div>
  );
}
