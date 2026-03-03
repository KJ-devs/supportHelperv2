'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Upload,
  Image,
  FileText,
  ScanLine,
  Brain,
  GitPullRequest,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const pipelineSteps = [
  {
    icon: Upload,
    label: 'Video Upload',
    color: 'blue',
    output: (
      <div className="space-y-1">
        <div className="text-[10px] text-slate-500">recording_2024.webm</div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-400">1.2 MB</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">00:08</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">1280x720</span>
        </div>
      </div>
    ),
  },
  {
    icon: Image,
    label: 'Keyframe Extraction',
    color: 'violet',
    output: (
      <div className="space-y-1">
        <div className="text-[10px] text-emerald-400">47 frames extracted</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-5 w-7 rounded-sm bg-white/10" />
          ))}
          <span className="text-[10px] text-slate-500">+42</span>
        </div>
      </div>
    ),
  },
  {
    icon: FileText,
    label: 'OCR Analysis',
    color: 'amber',
    output: (
      <div className="space-y-1">
        <div className="rounded bg-red-950/50 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
          TypeError: Cannot read properties
        </div>
        <div className="rounded bg-red-950/50 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
          of undefined (reading &apos;preferences&apos;)
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          at SettingsPage.tsx:47:12
        </div>
      </div>
    ),
  },
  {
    icon: ScanLine,
    label: 'UI Detection',
    color: 'pink',
    output: (
      <div className="space-y-1">
        <div className="relative h-12 w-full rounded bg-white/5">
          <div className="absolute left-1 top-1 h-4 w-8 rounded-sm border border-pink-500/40" />
          <div className="absolute left-3 top-6 h-3 w-14 rounded-sm border border-blue-500/40" />
          <div className="absolute right-2 top-2 h-6 w-6 rounded-sm border border-emerald-500/40" />
        </div>
        <div className="text-[10px] text-slate-400">
          12 elements &middot; 3 interactive &middot; 1 error state
        </div>
      </div>
    ),
  },
  {
    icon: Brain,
    label: 'Claude Vision',
    color: 'emerald',
    output: (
      <div className="space-y-1">
        <pre className="overflow-hidden rounded bg-white/5 p-1.5 font-mono text-[9px] leading-tight text-slate-300">
{`{
  "severity": "high",
  "type": "bug",
  "root_cause": "Null ref at
    user.preferences",
  "confidence": 0.87
}`}
        </pre>
      </div>
    ),
  },
  {
    icon: GitPullRequest,
    label: 'GitHub Issue + PR',
    color: 'blue',
    output: (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-white">#423 Fix null ref in SettingsPage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <GitPullRequest className="h-2.5 w-2.5 text-violet-400" />
          <span className="text-[10px] text-violet-400">#424 Add null check for user.preferences</span>
        </div>
      </div>
    ),
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'bg-blue-500' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'bg-violet-500' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'bg-amber-500' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', glow: 'bg-pink-500' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'bg-emerald-500' },
};

export function PipelineSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      /* Draw connecting line */
      gsap.from('.pipeline-connect-line', {
        scaleX: 0,
        transformOrigin: 'left',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
          end: 'top 20%',
          scrub: 1,
        },
      });

      /* Stagger node cards */
      gsap.from('.pipeline-node', {
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

      /* Flowing data packets */
      gsap.to('.data-packet', {
        x: '100vw',
        duration: 4,
        repeat: -1,
        stagger: 0.8,
        ease: 'none',
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="pipeline"
      className="relative overflow-hidden bg-[#030712] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wider text-blue-400">
            THE AI PIPELINE
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How the AI sees your bug
          </h2>
          <p className="mt-4 text-base text-slate-400">
            From screen recording to pull request — every step uses real data from your video.
          </p>
        </div>

        {/* Pipeline grid */}
        <div className="relative mt-16">
          {/* Horizontal connecting line (desktop) */}
          <div className="pipeline-connect-line absolute left-[8%] right-[8%] top-[60px] hidden h-px bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-emerald-500/30 lg:block" />

          {/* Data packets on the line */}
          <div className="pointer-events-none absolute left-0 top-[58px] hidden lg:block">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="data-packet absolute h-1.5 w-1.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50"
                style={{ left: `${-20 - i * 80}px` }}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {pipelineSteps.map((step, i) => {
              const colors = colorMap[step.color];
              return (
                <div
                  key={step.label}
                  className="pipeline-node group relative flex flex-col rounded-xl border border-white/5 bg-[#0a0f1e] p-4 transition-colors hover:border-white/10"
                >
                  {/* Icon */}
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${colors.bg}`}>
                    <step.icon className={`h-5 w-5 ${colors.text}`} />
                  </div>

                  {/* Step number + label */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-[10px] font-medium text-slate-500">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-white">{step.label}</span>
                  </div>

                  {/* Output preview */}
                  <div className="mt-auto rounded-lg bg-black/30 p-2.5">
                    {step.output}
                  </div>

                  {/* Arrow connector (mobile/tablet) */}
                  {i < pipelineSteps.length - 1 && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-slate-700 sm:hidden">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 0L6 12M6 12L1 7M6 12L11 7" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
