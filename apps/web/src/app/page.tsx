import type { Metadata } from 'next';
import { NavBarDark } from '@/components/landing/nav-bar-dark';
import { FooterDark } from '@/components/landing/footer-dark';
import {
  HeroLiveDemo,
  PipelineSection,
  WidgetShowcase,
  DashboardPreview,
  IntegrationsSection,
  PricingSection,
  CtaSection,
} from '@/components/landing-v4';

export const metadata: Metadata = {
  title: 'Support Helper — AI-Powered Bug Resolution',
  description:
    'Film the bug. AI finds the fix. Automatically. Add the SDK with one line of code and let AI investigate your codebase, find the root cause, and open a Pull Request with the fix.',
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      <NavBarDark />
      <main className="flex-1">
        <HeroLiveDemo />
        <PipelineSection />
        <WidgetShowcase />
        <DashboardPreview />
        <IntegrationsSection />
        <PricingSection />
        <CtaSection />
      </main>
      <FooterDark />
    </div>
  );
}
