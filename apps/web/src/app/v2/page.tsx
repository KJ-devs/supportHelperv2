import type { Metadata } from 'next';
import { NavBarDark } from '@/components/landing/nav-bar-dark';
import { FooterDark } from '@/components/landing/footer-dark';
import { HeroSplit } from './hero-split';
import { LogosV2 } from './logos-v2';
import { ProblemSection } from './problem-section';
import { SolutionSection } from './solution-section';
import { TimelineSection } from './timeline-section';
import { FeaturesV2 } from './features-v2';
import { TestimonialsSection } from './testimonials-section';
import { PricingV2Section } from './pricing-v2-section';
import { SecurityV2 } from './security-v2';
import { FaqSection } from './faq-section';
import { CtaFinalSection } from './cta-final-section';

export const metadata: Metadata = {
  title: 'Support Helper V2 — Bug Reports That Fix Themselves',
  description:
    "Bug reports shouldn't take longer than the fix. Your users record the bug in one click. AI reads your code and opens the fix. That's it.",
};

export default function LandingV2Page() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      <NavBarDark />
      <main className="flex-1">
        <HeroSplit />
        <LogosV2 />
        <ProblemSection />
        <SolutionSection />
        <TimelineSection />
        <FeaturesV2 />
        <TestimonialsSection />
        <PricingV2Section />
        <SecurityV2 />
        <FaqSection />
        <CtaFinalSection />
      </main>
      <FooterDark />
    </div>
  );
}
