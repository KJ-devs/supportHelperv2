'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Video, Brain, GitPullRequest, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    icon: Video,
    step: '01',
    label: 'User clicks Record',
    description: 'One click in the widget. No training needed.',
    color: 'blue',
  },
  {
    icon: Brain,
    step: '02',
    label: 'AI analyzes video + code',
    description: 'Frames extracted, OCR run, codebase investigated.',
    color: 'violet',
  },
  {
    icon: GitPullRequest,
    step: '03',
    label: 'PR opened automatically',
    description: 'Fix committed. Review and merge. Done.',
    color: 'emerald',
  },
];

export function SolutionSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.solution-heading', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.solution-heading',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.solution-mockup', {
        opacity: 0,
        y: 50,
        scale: 0.95,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.solution-mockup',
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.solution-step', {
        opacity: 0,
        y: 30,
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.solution-steps',
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
      className="relative bg-[#04080f] py-24 sm:py-32"
    >
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/5 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="solution-heading mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            The Solution
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            One widget.{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              One click.
            </span>{' '}
            AI handles the rest.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Embed the Support Helper SDK with a single line of code. Your users get a discreet
            widget. You get fully analyzed, automatically-fixed bug reports.
          </p>
        </div>

        {/* Widget mockup */}
        <div className="solution-mockup mx-auto mt-16 max-w-2xl">
          {/* Browser window */}
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-slate-800/70 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto flex h-6 w-48 items-center justify-center rounded-md bg-slate-700/60 text-xs text-slate-400">
                yourapp.com/dashboard
              </div>
            </div>

            {/* App content */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900 p-8">
              {/* Fake app content */}
              <div className="mb-6 space-y-2.5">
                <div className="h-4 w-48 rounded bg-slate-700/60" />
                <div className="h-3 w-full rounded bg-slate-700/40" />
                <div className="h-3 w-4/5 rounded bg-slate-700/40" />
              </div>

              {/* Widget floating button + panel */}
              <div className="relative">
                {/* Widget panel */}
                <div className="rounded-xl border border-blue-500/30 bg-slate-900/90 p-5 shadow-xl shadow-blue-500/10 backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
                      <Video className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Recording bug...</p>
                      <p className="text-xs text-slate-400">Screen + audio captured</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      <span className="text-xs font-medium text-red-400">REC</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    {[
                      { label: 'Video captured', done: true },
                      { label: 'AI analyzing frames', done: true },
                      { label: 'Investigating codebase', active: true },
                      { label: 'Generating PR', pending: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        {item.done ? (
                          <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </div>
                        ) : item.active ? (
                          <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                        ) : (
                          <div className="h-4 w-4 flex-shrink-0 rounded-full border border-slate-700" />
                        )}
                        <span
                          className={`text-xs ${
                            item.done
                              ? 'text-slate-400'
                              : item.active
                                ? 'text-blue-300'
                                : 'text-slate-600'
                          }`}
                        >
                          {item.label}
                        </span>
                        {item.done && (
                          <span className="ml-auto text-[10px] text-slate-600">done</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Widget trigger button */}
                <div className="absolute -bottom-4 -right-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/40">
                  <Video className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="solution-steps mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const colorMap: Record<string, string> = {
              blue: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
              violet: 'border-violet-500/20 bg-violet-500/10 text-violet-400',
              emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
            };
            const iconClass = colorMap[step.color] ?? 'border-white/10 bg-white/5 text-white';

            return (
              <div key={step.step} className="solution-step flex items-start gap-4">
                {/* Step + arrow */}
                <div className="flex items-center gap-2">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${iconClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-700 sm:hidden" />
                  )}
                </div>
                <div className="hidden sm:block">
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="mt-3 h-4 w-4 text-slate-700" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Step {step.step}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{step.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
