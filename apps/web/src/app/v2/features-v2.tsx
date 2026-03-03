'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  Film,
  Search,
  GitPullRequest,
  KeyRound,
  Plug,
  Shield,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    icon: Film,
    title: 'Video Capture + AI Vision',
    description:
      'Users record bugs in-app. AI extracts frames, OCR, console errors.',
    accent: 'blue',
    iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    glow: 'hover:shadow-blue-500/10 hover:border-blue-500/20',
    top: 'bg-gradient-to-r from-transparent via-blue-500/30 to-transparent',
  },
  {
    icon: Search,
    title: 'Deep Code Investigation',
    description:
      'AI reads your codebase, traces execution, finds root cause.',
    accent: 'violet',
    iconBg: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
    glow: 'hover:shadow-violet-500/10 hover:border-violet-500/20',
    top: 'bg-gradient-to-r from-transparent via-violet-500/30 to-transparent',
  },
  {
    icon: GitPullRequest,
    title: 'Auto-fix PR Generation',
    description:
      'AI writes the fix and opens a PR in your repo.',
    accent: 'emerald',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    glow: 'hover:shadow-emerald-500/10 hover:border-emerald-500/20',
    top: 'bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent',
  },
  {
    icon: KeyRound,
    title: 'BYOK — Your Keys',
    description:
      'Use OpenAI, Claude, or Gemini. Your data, your control.',
    accent: 'amber',
    iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    glow: 'hover:shadow-amber-500/10 hover:border-amber-500/20',
    top: 'bg-gradient-to-r from-transparent via-amber-500/30 to-transparent',
  },
  {
    icon: Plug,
    title: 'Integrations',
    description:
      'GitHub, Jira, Slack, Notion, HubSpot. Sync everywhere.',
    accent: 'pink',
    iconBg: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
    glow: 'hover:shadow-pink-500/10 hover:border-pink-500/20',
    top: 'bg-gradient-to-r from-transparent via-pink-500/30 to-transparent',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'AES-256, SSO/SAML, audit logs, SOC 2 ready.',
    accent: 'slate',
    iconBg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    glow: 'hover:shadow-slate-500/10 hover:border-slate-500/20',
    top: 'bg-gradient-to-r from-transparent via-slate-500/30 to-transparent',
  },
];

export function FeaturesV2() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.feature-card', {
        opacity: 0,
        y: 50,
        stagger: 0.1,
        duration: 0.65,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.features-heading', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.features-heading',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#0a0f1e] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="features-heading mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              resolve bugs faster
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            A complete platform from capture to fix, powered by the latest AI models.
          </p>
        </div>

        {/* Feature cards grid — 2 columns, 3 rows */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`feature-card group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 shadow-xl transition-all duration-300 hover:bg-white/[0.04] hover:shadow-2xl ${feature.glow}`}
              >
                {/* Top accent line — visible on hover */}
                <div
                  className={`absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${feature.top}`}
                />

                {/* Icon */}
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border ${feature.iconBg}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Text */}
                <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom divider */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
    </section>
  );
}
