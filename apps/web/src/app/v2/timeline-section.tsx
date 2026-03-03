'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Code2, Video, Brain, GitPullRequest } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const TIMELINE_STEPS = [
  {
    icon: Code2,
    title: 'Integrate',
    number: '01',
    color: 'blue',
    description:
      'Add one line to your app. The SDK is a lightweight JavaScript widget that works with any framework.',
    code: `<script src="https://cdn.supporthelper.io/sdk.js" data-key="sk_live_..."></script>`,
    detail: 'React, Vue, Angular, Svelte, plain HTML — all supported.',
  },
  {
    icon: Video,
    title: 'Capture',
    number: '02',
    color: 'orange',
    description:
      "Your user encounters a bug and clicks the widget. They record what's happening — screen, clicks, console errors — in one flow.",
    detail: 'No installation. No screenshots. No long email threads.',
  },
  {
    icon: Brain,
    title: 'Analyze',
    number: '03',
    color: 'violet',
    description:
      'AI extracts video keyframes, runs OCR on screenshots, analyzes error context, and investigates your codebase to find the root cause.',
    detail: 'Powered by GPT-4 Vision, Claude, or your own API key (BYOK).',
  },
  {
    icon: GitPullRequest,
    title: 'Fix',
    number: '04',
    color: 'emerald',
    description:
      'A Pull Request is generated with the fix applied, tests written, and a clear explanation of the root cause. Review and merge.',
    detail: 'GitHub, GitLab, and Bitbucket supported.',
  },
];

export function TimelineSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Draw the timeline line
      gsap.fromTo(
        '.timeline-line-fill',
        { scaleY: 0, transformOrigin: 'top center' },
        {
          scaleY: 1,
          duration: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.timeline-container',
            start: 'top 60%',
            end: 'bottom 60%',
            scrub: true,
          },
        }
      );

      // Animate each step in
      gsap.from('.timeline-item', {
        opacity: 0,
        x: 40,
        stagger: 0.2,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.timeline-container',
          start: 'top 60%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.timeline-heading', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.timeline-heading',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  const colorMap: Record<string, { dot: string; icon: string; badge: string }> = {
    blue: {
      dot: 'bg-blue-500 shadow-blue-500/50',
      icon: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
      badge: 'text-blue-400',
    },
    orange: {
      dot: 'bg-orange-500 shadow-orange-500/50',
      icon: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
      badge: 'text-orange-400',
    },
    violet: {
      dot: 'bg-violet-500 shadow-violet-500/50',
      icon: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
      badge: 'text-violet-400',
    },
    emerald: {
      dot: 'bg-emerald-500 shadow-emerald-500/50',
      icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      badge: 'text-emerald-400',
    },
  };

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="timeline-heading mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            From bug report to{' '}
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              merged PR
            </span>{' '}
            in minutes
          </h2>
        </div>

        {/* Timeline */}
        <div className="timeline-container relative mx-auto mt-16 max-w-3xl">
          {/* Vertical line track */}
          <div
            ref={lineRef}
            className="absolute left-5 top-0 h-full w-px bg-slate-800 sm:left-6"
          >
            <div className="timeline-line-fill absolute inset-0 bg-gradient-to-b from-blue-500 via-violet-500 to-emerald-500" />
          </div>

          {/* Steps */}
          <div className="space-y-12">
            {TIMELINE_STEPS.map((step) => {
              const Icon = step.icon;
              const colors = colorMap[step.color] ?? colorMap.blue;

              return (
                <div key={step.number} className="timeline-item relative flex gap-6 pl-14 sm:pl-16">
                  {/* Dot on line */}
                  <div
                    className={`absolute left-3.5 top-1.5 h-3 w-3 rounded-full shadow-lg sm:left-[18px] ${colors.dot}`}
                  />

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${colors.icon}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-widest ${colors.badge}`}>
                            {step.number}
                          </span>
                          <h3 className="text-lg font-bold text-white">{step.title}</h3>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-400">
                          {step.description}
                        </p>

                        {/* Code snippet for step 1 */}
                        {step.code && (
                          <div className="mt-4 overflow-x-auto rounded-lg border border-white/5 bg-slate-900/80 p-3">
                            <code className="text-xs text-blue-300">{step.code}</code>
                          </div>
                        )}

                        <p className="mt-3 text-xs text-slate-600">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
