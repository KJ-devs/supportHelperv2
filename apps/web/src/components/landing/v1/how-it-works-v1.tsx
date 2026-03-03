'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Code2, Video, Brain, GitPullRequest } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    step: '01',
    icon: Code2,
    title: 'Integrate',
    description: 'Add the SDK with one line of code. Works with any JavaScript framework.',
    code: `<script src="cdn.supporthelper.io/sdk.js"\n  data-sdk-key="sk_live_...">\n</script>`,
    color: 'from-blue-500 to-cyan-500',
    glow: 'shadow-blue-500/20',
    border: 'border-blue-500/20',
  },
  {
    step: '02',
    icon: Video,
    title: 'Capture',
    description:
      'Users film the bug directly in your app. Video, console logs, and network requests captured.',
    color: 'from-violet-500 to-purple-500',
    glow: 'shadow-violet-500/20',
    border: 'border-violet-500/20',
  },
  {
    step: '03',
    icon: Brain,
    title: 'Analyze',
    description:
      'AI extracts frames, runs OCR, and uses GPT-4 Vision. Then investigates your codebase.',
    color: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/20',
    border: 'border-amber-500/20',
  },
  {
    step: '04',
    icon: GitPullRequest,
    title: 'Fix',
    description:
      'Receive a detailed analysis and an auto-generated Pull Request with the fix.',
    color: 'from-emerald-500 to-green-500',
    glow: 'shadow-emerald-500/20',
    border: 'border-emerald-500/20',
  },
];

export function HowItWorksV1() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Animate the connecting line (horizontal)
      gsap.from('.v1-hiw-line', {
        scaleX: 0,
        transformOrigin: 'left',
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
          end: 'top 20%',
          scrub: 1.5,
        },
      });

      gsap.from('.v1-hiw-card', {
        opacity: 0,
        y: 50,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="v1-how-it-works"
      className="relative bg-[#030712] py-24 sm:py-32"
    >
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-blue-400">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            From bug report to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              merged PR
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Four steps. Fully automated. No manual triage.
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative mt-20">
          {/* Horizontal connecting line (desktop) */}
          <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px lg:block">
            <div className="h-full w-full bg-white/5" />
            <div
              className="v1-hiw-line absolute inset-0 h-px bg-gradient-to-r from-blue-500/60 via-violet-500/60 to-emerald-500/60"
            />
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.step} className="v1-hiw-card group relative flex flex-col">
                {/* Icon circle */}
                <div className="relative z-10 mb-6 flex justify-center lg:justify-start">
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg ${step.glow}`}
                  >
                    <step.icon className="h-7 w-7 text-white" />
                    {/* Outer ring */}
                    <div className="absolute -inset-1 rounded-[18px] border border-white/5 bg-[#030712]" style={{ zIndex: -1 }} />
                  </div>
                </div>

                {/* Card */}
                <div
                  className={`flex-1 rounded-2xl border ${step.border} bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]`}
                >
                  <div className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-slate-600">
                    Step {step.step}
                  </div>
                  <h3 className="text-xl font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>

                  {step.code && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-black/40">
                      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-400/60" />
                        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400/60" />
                        <div className="h-1.5 w-1.5 rounded-full bg-green-400/60" />
                        <span className="ml-1 font-mono text-xs text-slate-600">index.html</span>
                      </div>
                      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-slate-300">
                        <code>{step.code}</code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
