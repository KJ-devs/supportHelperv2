'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Clock,
  User,
  Tag,
  Bot,
  ChevronDown,
  FileCode,
  Play,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const affectedFiles = [
  { path: 'src/pages/SettingsPage.tsx', line: 47, relevance: 'primary' },
  { path: 'src/hooks/useUserPreferences.ts', line: 12, relevance: 'secondary' },
  { path: 'src/context/AuthContext.tsx', line: 89, relevance: 'tertiary' },
];

const relevanceColors: Record<string, string> = {
  primary: 'border-l-red-500',
  secondary: 'border-l-yellow-500',
  tertiary: 'border-l-slate-600',
};

export function DashboardPreview() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.dashboard-left', {
        x: -40,
        opacity: 0,
        duration: 0.7,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });
      gsap.from('.dashboard-right', {
        x: 40,
        opacity: 0,
        duration: 0.7,
        delay: 0.15,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });

      /* Confidence counter */
      gsap.from('.dash-confidence-ring', {
        strokeDashoffset: 251,
        duration: 1.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.dash-diagnosis',
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#030712] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wider text-emerald-400">
            DASHBOARD
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AI diagnosis at a glance
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Every ticket gets an AI analysis panel with root cause, affected files, and suggested fix.
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="mt-16 overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1e] shadow-2xl shadow-blue-500/5">
          {/* Tab bar */}
          <div className="flex items-center gap-4 border-b border-white/5 px-6 py-3">
            <span className="border-b-2 border-blue-500 pb-1 text-xs font-medium text-white">
              Ticket Details
            </span>
            <span className="text-xs text-slate-500">Activity</span>
            <span className="text-xs text-slate-500">Related</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Left — Ticket Detail */}
            <div className="dashboard-left col-span-3 border-r border-white/5 p-6">
              {/* Ticket header */}
              <div className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                        HIGH
                      </span>
                      <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                        BUG
                      </span>
                      <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
                        #SH-1847
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      TypeError in Dashboard Settings
                    </h3>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 2 min ago
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> john.doe@acme.com
                  </span>
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Chrome 120 / macOS
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <p className="text-sm leading-relaxed text-slate-300">
                  Cannot read properties of undefined (reading &apos;preferences&apos;) when
                  clicking on the Settings tab. Error occurs immediately on navigation. User was
                  previously on the Dashboard overview page.
                </p>
              </div>

              {/* Video player area */}
              <div className="overflow-hidden rounded-lg border border-white/5 bg-black/40">
                <div className="flex aspect-video items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                      <Play className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs text-slate-500">00:08 recording</span>
                  </div>
                </div>
                {/* Scrubber bar */}
                <div className="flex items-center gap-3 border-t border-white/5 px-3 py-2">
                  <Play className="h-3 w-3 text-slate-500" />
                  <div className="h-1 flex-1 rounded-full bg-white/10">
                    <div className="h-1 w-1/3 rounded-full bg-blue-500" />
                  </div>
                  <span className="text-[10px] text-slate-500">0:03 / 0:08</span>
                </div>
              </div>
            </div>

            {/* Right — AI Diagnosis */}
            <div className="dash-diagnosis col-span-2 bg-[#080d19] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    AI Diagnosis
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-600" />
              </div>

              {/* Confidence */}
              <div className="mb-5 flex items-center gap-4">
                <div className="relative h-14 w-14">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 88 88">
                    <circle cx={44} cy={44} r={40} fill="none" stroke="#1e293b" strokeWidth={6} />
                    <circle
                      className="dash-confidence-ring"
                      cx={44}
                      cy={44}
                      r={40}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth={6}
                      strokeLinecap="round"
                      strokeDasharray={251}
                      strokeDashoffset={251 * (1 - 0.87)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-emerald-400">87%</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Confidence in root cause</span>
                  <div className="mt-0.5 flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">High confidence</span>
                  </div>
                </div>
              </div>

              {/* Root cause */}
              <div className="mb-5">
                <h4 className="mb-2 text-xs font-medium text-slate-300">Root Cause</h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  Accessing <code className="rounded bg-white/5 px-1 py-0.5 text-[11px] text-pink-400">user.preferences</code> in
                  SettingsPage.tsx before the user profile data has loaded. The component renders immediately on navigation
                  but the <code className="rounded bg-white/5 px-1 py-0.5 text-[11px] text-pink-400">useUserPreferences</code> hook
                  returns <code className="rounded bg-white/5 px-1 py-0.5 text-[11px] text-pink-400">undefined</code> until the API
                  response arrives.
                </p>
              </div>

              {/* Affected files */}
              <div className="mb-5">
                <h4 className="mb-2 text-xs font-medium text-slate-300">Affected Files</h4>
                <div className="space-y-1.5">
                  {affectedFiles.map((file) => (
                    <div
                      key={file.path}
                      className={`flex items-center gap-2 border-l-2 ${relevanceColors[file.relevance]} rounded-r bg-white/[0.02] py-1.5 pl-2.5 pr-2`}
                    >
                      <FileCode className="h-3 w-3 shrink-0 text-slate-500" />
                      <span className="truncate font-mono text-[11px] text-slate-300">
                        {file.path}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-slate-600">
                        L{file.line}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested fix */}
              <div>
                <h4 className="mb-2 text-xs font-medium text-slate-300">Suggested Fix</h4>
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-xs leading-relaxed text-slate-400">
                    Add an early return or loading guard in SettingsPage before accessing{' '}
                    <code className="text-[11px] text-pink-400">user.preferences</code>. Alternatively,
                    initialize the preferences hook with a default value to prevent the null reference.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
