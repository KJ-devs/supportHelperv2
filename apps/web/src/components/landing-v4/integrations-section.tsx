'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, MessageSquare, ExternalLink } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const integrations = [
  {
    name: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
    highlighted: true,
    preview: (
      <div className="rounded-lg border border-white/5 bg-black/30 p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-white">
            Fix null ref in SettingsPage.tsx
          </span>
        </div>
        <span className="text-[10px] text-slate-500">#423 opened by support-helper[bot]</span>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] text-red-400">
            bug
          </span>
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-400">
            high-priority
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
          <Check className="h-2.5 w-2.5" /> AI-generated description + repro steps
        </div>
      </div>
    ),
  },
  {
    name: 'Jira',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23 0H11.44a5.217 5.217 0 0 0 5.217 5.217h2.129v2.054A5.22 5.22 0 0 0 24 12.49V1.005A1.005 1.005 0 0 0 23 0z" />
      </svg>
    ),
    highlighted: false,
    preview: (
      <div className="rounded-lg border border-white/5 bg-black/30 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">
            PROJ-847
          </span>
          <span className="text-[11px] text-white">TypeError in Settings</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="rounded bg-red-500/10 px-1 py-0.5 text-red-400">Highest</span>
          <span>Backlog</span>
          <span className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-slate-600" />
            Unassigned
          </span>
        </div>
      </div>
    ),
  },
  {
    name: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
    highlighted: false,
    preview: (
      <div className="rounded-lg border border-white/5 bg-black/30 p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-slate-500" />
          <span className="text-[10px] text-slate-500">#bugs</span>
        </div>
        <div className="rounded bg-white/[0.03] p-2">
          <div className="mb-1 flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-indigo-500/20" />
            <span className="text-[10px] font-medium text-white">Support Helper</span>
            <span className="text-[9px] text-slate-600">2:34 PM</span>
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400">
            New high-severity bug: TypeError in Settings — Null ref at user.preferences
          </p>
        </div>
      </div>
    ),
  },
  {
    name: 'Notion',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L2.58 2.585c-.466.047-.56.28-.374.466l2.253 1.157zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.494-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.232V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.455-.234 4.763 7.28v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.222-.186z" />
      </svg>
    ),
    highlighted: false,
    preview: (
      <div className="rounded-lg border border-white/5 bg-black/30 p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-slate-600" />
          <span className="text-[11px] text-white">Bug Reports Database</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-12 text-slate-600">Status</span>
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-400">Open</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-12 text-slate-600">Priority</span>
            <span className="text-slate-400">High</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="w-12 text-slate-600">AI Score</span>
            <span className="text-emerald-400">87%</span>
          </div>
        </div>
      </div>
    ),
  },
];

export function IntegrationsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.integration-card', {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative overflow-hidden bg-[#030712] py-24 sm:py-32"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wider text-pink-400">
            INTEGRATIONS
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Fits into your workflow
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Every bug report automatically flows into the tools your team already uses.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className={`integration-card group rounded-xl border p-5 transition-all ${
                integration.highlighted
                  ? 'border-blue-500/20 bg-blue-500/[0.03]'
                  : 'border-white/5 bg-[#0a0f1e] hover:border-white/10'
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    integration.highlighted ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-400'
                  }`}>
                    {integration.icon}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{integration.name}</span>
                    {integration.highlighted && (
                      <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-medium text-blue-400">
                        Auto-sync
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {integration.preview}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
