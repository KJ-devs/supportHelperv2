'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  Film,
  Search,
  GitPullRequest,
  Building2,
  KeyRound,
  BarChart3,
  Plug,
  Shield,
  Zap,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor: string;
  glowColor: string;
  hoverBorder: string;
}

const FEATURES: Feature[] = [
  {
    icon: Film,
    title: 'Video Capture + AI Vision',
    description:
      'Users record bugs in-app. AI extracts frames, OCR text, console errors, and network calls automatically.',
    iconColor: 'text-blue-400',
    glowColor: 'group-hover:shadow-blue-500/10',
    hoverBorder: 'hover:border-blue-500/20',
  },
  {
    icon: Search,
    title: 'Deep Code Investigation',
    description:
      'AI autonomously explores your codebase, reads files, and traces execution paths to pinpoint the root cause.',
    iconColor: 'text-violet-400',
    glowColor: 'group-hover:shadow-violet-500/10',
    hoverBorder: 'hover:border-violet-500/20',
  },
  {
    icon: GitPullRequest,
    title: 'Auto-fix PR Generation',
    description:
      'Beyond diagnosis — the AI writes the actual fix and opens a Pull Request in your repository.',
    iconColor: 'text-emerald-400',
    glowColor: 'group-hover:shadow-emerald-500/10',
    hoverBorder: 'hover:border-emerald-500/20',
  },
  {
    icon: KeyRound,
    title: 'Bring Your Own Key (BYOK)',
    description:
      'Use your own OpenAI, Anthropic, or Gemini API key. Your data stays under your control, always.',
    iconColor: 'text-amber-400',
    glowColor: 'group-hover:shadow-amber-500/10',
    hoverBorder: 'hover:border-amber-500/20',
  },
  {
    icon: Plug,
    title: 'Integrations',
    description:
      'Connect with GitHub, Jira, Slack, HubSpot, and Notion. Sync tickets across your tools automatically.',
    iconColor: 'text-pink-400',
    glowColor: 'group-hover:shadow-pink-500/10',
    hoverBorder: 'hover:border-pink-500/20',
  },
  {
    icon: Building2,
    title: 'Multi-tenant Architecture',
    description:
      'Built for agencies and enterprises. Full data isolation per organization with role-based access.',
    iconColor: 'text-cyan-400',
    glowColor: 'group-hover:shadow-cyan-500/10',
    hoverBorder: 'hover:border-cyan-500/20',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Budget Control',
    description:
      'Track AI spending, set budget limits per application, and monitor analysis quality in real-time.',
    iconColor: 'text-indigo-400',
    glowColor: 'group-hover:shadow-indigo-500/10',
    hoverBorder: 'hover:border-indigo-500/20',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'AES-256-GCM encryption for API keys, SSO/SAML support, audit logs, and SOC 2 compliance ready.',
    iconColor: 'text-slate-300',
    glowColor: 'group-hover:shadow-slate-500/10',
    hoverBorder: 'hover:border-slate-500/20',
  },
  {
    icon: Zap,
    title: 'Real-time Dashboard',
    description:
      'Live WebSocket updates, instant ticket notifications, and powerful search powered by MeiliSearch.',
    iconColor: 'text-yellow-400',
    glowColor: 'group-hover:shadow-yellow-500/10',
    hoverBorder: 'hover:border-yellow-500/20',
  },
];

export function FeaturesV1() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v1-feature-card', {
        opacity: 0,
        y: 40,
        stagger: {
          amount: 0.7,
          grid: [3, 3],
          from: 'start',
        },
        duration: 0.7,
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
    <section
      ref={sectionRef}
      id="v1-features"
      className="relative bg-[#030712] py-24 sm:py-32"
    >
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      {/* Subtle dark background variation */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(99,102,241,0.03)_0%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-violet-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              ship faster
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            A complete platform from capture to fix, powered by the latest AI models.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`v1-feature-card group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 shadow-lg transition-all duration-300 ${feature.hoverBorder} ${feature.glowColor} hover:bg-white/[0.04] hover:shadow-xl`}
            >
              {/* Glass highlight on top edge */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div className="relative z-10">
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-white/[0.05] ${feature.iconColor}`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
