'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Circle,
  Check,
  AlertTriangle,
  Bug,
  Loader2,
  X,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const widgetStates = [
  {
    label: 'Idle',
    description: 'Floating action button',
    content: (
      <div className="flex h-full items-end justify-end p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6 text-white">
            <circle cx={12} cy={12} r={10} />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1={12} y1={17} x2={12.01} y2={17} />
          </svg>
        </div>
      </div>
    ),
  },
  {
    label: 'Open',
    description: 'Start recording view',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Report an Issue</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col items-center p-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-indigo-400">
                <rect x={2} y={2} width={20} height={20} rx={2.18} ry={2.18} />
                <line x1={7} y1={2} x2={7} y2={22} />
                <line x1={17} y1={2} x2={17} y2={22} />
                <line x1={2} y1={12} x2={22} y2={12} />
              </svg>
            </div>
            <p className="mb-3 text-center text-[10px] text-slate-400">
              Record your screen to capture the issue
            </p>
            <button className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 text-[11px] font-medium text-white">
              <Circle className="h-2.5 w-2.5 fill-current" />
              Start Recording
            </button>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Recording',
    description: 'Capture in progress',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Recording...</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col items-center p-4">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-base text-white">00:05</span>
            </div>
            <p className="mb-3 text-[10px] text-slate-400">Recording in progress...</p>
            <button className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-red-500 text-[11px] font-medium text-white">
              <div className="h-2.5 w-2.5 rounded-sm bg-white" />
              Stop Recording
            </button>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Preview',
    description: 'Review captured video',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Preview</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col p-3">
            <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-slate-800">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white/30">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>00:05</span><span>0.8 MB</span>
            </div>
            <div className="flex gap-2">
              <button className="flex h-7 flex-1 items-center justify-center rounded-lg border border-white/10 text-[10px] text-slate-300">
                Record again
              </button>
              <button className="flex h-7 flex-1 items-center justify-center rounded-lg bg-indigo-500 text-[10px] font-medium text-white">
                Use this video
              </button>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Editing',
    description: 'Add details to report',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Report Details</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col gap-2 p-3">
            <div>
              <label className="mb-0.5 block text-[9px] font-medium text-slate-400">Title</label>
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white">
                TypeError in Dashboard
              </div>
            </div>
            <div>
              <label className="mb-0.5 block text-[9px] font-medium text-slate-400">Description</label>
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white">
                Cannot read properties...
              </div>
            </div>
            <button className="mt-1 flex h-7 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-500 text-[10px] font-medium text-white">
              Send Report
            </button>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Submitting',
    description: 'Uploading video & data',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Sending...</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-xs text-slate-400">Sending your report...</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Analyzing',
    description: 'AI processes the video',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Analyzing...</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col gap-2 p-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
            </div>
            <div className="space-y-1">
              {['Extracting keyframes', 'Running OCR', 'UI Detection'].map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                  <Check className="h-3 w-3 text-emerald-400" />
                  {s}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                AI Vision Analysis
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: 'Success',
    description: 'Results with AI diagnosis',
    content: (
      <div className="flex h-full items-end justify-end p-3">
        <div className="w-56 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white">Report Sent!</span>
            <X className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-1.5">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
                <Check className="h-2.5 w-2.5 text-emerald-400" />
              </div>
              <span className="text-[11px] font-medium text-white">Analysis Complete</span>
            </div>
            <div className="flex gap-1">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
                <AlertTriangle className="h-2 w-2" /> High
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
                <Bug className="h-2 w-2" /> Bug
              </span>
            </div>
            <div className="rounded bg-white/5 p-2 text-[9px] leading-relaxed text-slate-300">
              Null reference in SettingsPage.tsx:47 when accessing user.preferences
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

export function WidgetShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % widgetStates.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.showcase-title', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.showcase-frame', {
        y: 40,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.showcase-grid',
          start: 'top 75%',
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
        <div className="showcase-title mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wider text-violet-400">
            WIDGET STATES
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Every step of the reporting flow
          </h2>
          <p className="mt-4 text-base text-slate-400">
            The SDK widget guides users through recording, previewing, and submitting — then shows AI results in real time.
          </p>
        </div>

        <div className="showcase-grid mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
          {widgetStates.map((state, i) => (
            <div
              key={state.label}
              className={`showcase-frame group relative overflow-hidden rounded-xl border transition-all duration-300 ${
                i === activeIndex
                  ? 'border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              {/* Phone-like frame */}
              <div className="relative aspect-[9/16] max-h-[320px] overflow-hidden bg-[#0a0f1e]">
                {/* Status bar */}
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-[8px] text-slate-600">9:41</span>
                  <div className="flex gap-1">
                    <div className="h-1.5 w-3 rounded-sm bg-slate-700" />
                    <div className="h-1.5 w-1.5 rounded-sm bg-slate-700" />
                  </div>
                </div>

                {/* Fake app background */}
                <div className="absolute inset-0 top-5 p-2">
                  <div className="h-3 w-12 rounded bg-white/5" />
                  <div className="mt-2 h-2 w-20 rounded bg-white/[0.03]" />
                  <div className="mt-2 h-2 w-16 rounded bg-white/[0.03]" />
                </div>

                {/* Widget content */}
                <div className="relative h-full">
                  {state.content}
                </div>
              </div>

              {/* Label */}
              <div className={`border-t px-3 py-2 ${
                i === activeIndex ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-white/5 bg-[#0a0f1e]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium ${
                    i === activeIndex
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-slate-500'
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`text-xs font-medium ${
                    i === activeIndex ? 'text-white' : 'text-slate-400'
                  }`}>
                    {state.label}
                  </span>
                </div>
                <p className="mt-0.5 pl-6 text-[10px] text-slate-500">{state.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
