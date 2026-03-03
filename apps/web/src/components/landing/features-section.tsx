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

const FEATURES = [
  {
    icon: Film,
    title: 'Video Capture + AI Vision',
    description:
      'Users record bugs in-app. AI extracts frames, OCR text, console errors, and network calls automatically.',
    gradient: 'from-blue-500/10 to-cyan-500/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: Search,
    title: 'Deep Code Investigation',
    description:
      'AI autonomously explores your codebase, reads files, and traces execution paths to pinpoint the root cause.',
    gradient: 'from-violet-500/10 to-purple-500/10',
    iconColor: 'text-violet-400',
  },
  {
    icon: GitPullRequest,
    title: 'Auto-fix PR Generation',
    description:
      'Beyond diagnosis — the AI writes the actual fix and opens a Pull Request in your repository.',
    gradient: 'from-emerald-500/10 to-green-500/10',
    iconColor: 'text-emerald-400',
  },
  {
    icon: KeyRound,
    title: 'Bring Your Own Key (BYOK)',
    description:
      'Use your own OpenAI, Anthropic, or Gemini API key. Your data stays under your control, always.',
    gradient: 'from-amber-500/10 to-orange-500/10',
    iconColor: 'text-amber-400',
  },
  {
    icon: Plug,
    title: 'Integrations',
    description:
      'Connect with GitHub, Jira, Slack, HubSpot, and Notion. Sync tickets across your tools automatically.',
    gradient: 'from-pink-500/10 to-rose-500/10',
    iconColor: 'text-pink-400',
  },
  {
    icon: Building2,
    title: 'Multi-tenant Architecture',
    description:
      'Built for agencies and enterprises. Full data isolation per organization with role-based access.',
    gradient: 'from-cyan-500/10 to-teal-500/10',
    iconColor: 'text-cyan-400',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Budget Control',
    description:
      'Track AI spending, set budget limits per application, and monitor analysis quality in real-time.',
    gradient: 'from-indigo-500/10 to-blue-500/10',
    iconColor: 'text-indigo-400',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'AES-256-GCM encryption for API keys, SSO/SAML support, audit logs, and SOC 2 compliance ready.',
    gradient: 'from-slate-500/10 to-zinc-500/10',
    iconColor: 'text-slate-300',
  },
  {
    icon: Zap,
    title: 'Real-time Dashboard',
    description:
      'Live WebSocket updates, instant ticket notifications, and a powerful search powered by MeiliSearch.',
    gradient: 'from-yellow-500/10 to-amber-500/10',
    iconColor: 'text-yellow-400',
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.feature-card', {
        opacity: 0,
        y: 40,
        stagger: {
          amount: 0.6,
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
    <section ref={sectionRef} id="features" className="relative bg-[#0a0f1e] py-24 sm:py-32">
      {/* Subtle top gradient divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              resolve bugs faster
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
              className="feature-card group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
            >
              {/* Hover glow */}
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />

              <div className="relative z-10">
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/5 bg-white/5 ${feature.iconColor}`}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
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
