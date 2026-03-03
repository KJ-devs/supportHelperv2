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
    description: 'Add the SDK widget with a single line of code. Works with React, Vue, Angular, or vanilla JS.',
    code: `<script src="cdn.supporthelper.io/sdk.js"
  data-sdk-key="sk_live_xxxxx">
</script>`,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    step: '02',
    icon: Video,
    title: 'Capture',
    description: 'Users click the widget to record their screen. Video, console logs, and network requests are captured automatically.',
    color: 'from-violet-500 to-purple-500',
  },
  {
    step: '03',
    icon: Brain,
    title: 'Analyze',
    description: 'AI extracts key frames, runs OCR, and uses GPT-4 Vision to understand the bug. Then it investigates your codebase to find the root cause.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    step: '04',
    icon: GitPullRequest,
    title: 'Fix',
    description: 'Receive a detailed analysis and an auto-generated Pull Request with the fix, directly in your GitHub repository.',
    color: 'from-emerald-500 to-green-500',
  },
];

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Animate the connecting line
      gsap.from('.hiw-line', {
        scaleY: 0,
        transformOrigin: 'top',
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
          end: 'bottom 80%',
          scrub: 1,
        },
      });

      // Stagger cards
      gsap.from('.hiw-card', {
        opacity: 0,
        y: 60,
        stagger: 0.2,
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
    <section ref={sectionRef} id="how-it-works" className="relative bg-[#030712] py-24 sm:py-32">
      {/* Section header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            From bug report to PR in{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              minutes
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            No manual triage. No back-and-forth. Just automated bug resolution.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mx-auto mt-20 max-w-4xl">
          {/* Connecting line (desktop) */}
          <div className="hiw-line absolute left-[31px] top-0 hidden h-full w-px bg-gradient-to-b from-blue-500/50 via-violet-500/50 to-emerald-500/50 lg:block" />

          <div className="space-y-12 lg:space-y-16">
            {STEPS.map((item) => (
              <div key={item.step} className="hiw-card relative flex gap-8 lg:gap-12">
                {/* Step number + icon */}
                <div className="hidden flex-shrink-0 lg:block">
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-lg`}
                  >
                    <item.icon className="h-7 w-7 text-white" />
                    {/* Glow */}
                    <div
                      className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${item.color} opacity-30 blur-xl`}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm transition-colors hover:border-white/10 hover:bg-white/[0.04] sm:p-8">
                  <div className="flex items-center gap-4 lg:hidden">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.color}`}
                    >
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Step {item.step}
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <div>
                      <span className="hidden text-xs font-bold uppercase tracking-widest text-slate-500 lg:block">
                        Step {item.step}
                      </span>
                      <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                        {item.title}
                      </h3>
                      <p className="mt-3 max-w-lg text-slate-400">{item.description}</p>
                    </div>
                  </div>

                  {item.code && (
                    <div className="mt-5 overflow-hidden rounded-xl border border-white/5 bg-black/40">
                      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                        <div className="h-2 w-2 rounded-full bg-red-400/60" />
                        <div className="h-2 w-2 rounded-full bg-yellow-400/60" />
                        <div className="h-2 w-2 rounded-full bg-green-400/60" />
                        <span className="ml-2 text-xs text-slate-500">index.html</span>
                      </div>
                      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-slate-300">
                        <code>{item.code}</code>
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
