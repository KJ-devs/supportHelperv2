'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

gsap.registerPlugin();

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';


export function HeroSplit() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Phase 1: OLD cards stagger in
      tl.from('.old-card', {
        opacity: 0,
        y: 40,
        scale: 0.85,
        stagger: 0.15,
        duration: 0.5,
      });

      // Phase 2: Divider line shoots in
      tl.fromTo(
        '.split-divider',
        { scaleY: 0, transformOrigin: 'top center' },
        { scaleY: 1, duration: 0.4, ease: 'power2.inOut' },
        '+=0.1'
      );

      // Phase 2b: Right side reveal (clip from left to right)
      tl.fromTo(
        '.right-panel',
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power3.inOut' },
        '-=0.3'
      );

      // Phase 3: NEW cards stagger in
      tl.from(
        '.new-card',
        {
          opacity: 0,
          x: 30,
          stagger: 0.2,
          duration: 0.5,
        },
        '-=0.2'
      );

      // Phase 4: Title words animate in
      tl.from(
        '.title-word',
        {
          opacity: 0,
          y: 50,
          rotationX: -30,
          stagger: 0.06,
          duration: 0.6,
        },
        '-=0.3'
      );

      // Subtitle + CTA
      tl.from('.hero-subtitle-v2', { opacity: 0, y: 20, duration: 0.5 }, '-=0.2');
      tl.from('.hero-cta-v2', { opacity: 0, y: 20, stagger: 0.1, duration: 0.4 }, '-=0.3');
    },
    { scope: containerRef }
  );

  // Floating animation for old cards (chaos effect)
  useEffect(() => {
    const cards = document.querySelectorAll('.old-card');
    cards.forEach((card, i) => {
      gsap.to(card, {
        y: i % 2 === 0 ? -6 : 6,
        x: i % 2 === 0 ? 3 : -3,
        duration: 2 + i * 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
  }, []);

  const titleWords = [
    { text: 'Bug reports', highlight: false },
    { text: "shouldn't", highlight: false },
    { text: 'take', highlight: false },
    { text: 'longer', highlight: 'red' },
    { text: 'than', highlight: false },
    { text: 'the', highlight: false },
    { text: 'fix.', highlight: 'blue' },
  ];

  return (
    <section ref={containerRef} className="relative min-h-screen overflow-hidden bg-[#030712] pt-16">
      {/* Split screen visual */}
      <div className="relative flex h-[60vh] min-h-[420px] w-full overflow-hidden">
        {/* OLD WAY — left panel */}
        <div className="relative flex w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-red-950/60 via-[#030712] to-orange-950/40 px-8 py-12">
          {/* Red tint overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent" />
          {/* Noise texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            }}
          />

          {/* Label */}
          <div className="relative z-10 mb-6 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-red-400">
              The Old Way
            </span>
          </div>

          {/* Chaos cards */}
          <div className="relative z-10 w-full max-w-xs space-y-3">
            {/* Slack card */}
            <div className="old-card -rotate-1 rounded-lg border border-red-500/20 bg-slate-900/80 p-3 shadow-xl backdrop-blur-sm">
              <div className="mb-1 flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-[#4A154B]" />
                <span className="text-xs font-semibold text-slate-300">Slack — #bugs</span>
                <span className="ml-auto text-[10px] text-slate-500">2:34 PM</span>
              </div>
              <p className="text-xs text-slate-400">Can someone reproduce this? It works on my machine...</p>
            </div>

            {/* Jira card */}
            <div className="old-card rotate-2 rounded-lg border border-orange-500/20 bg-slate-900/80 p-3 shadow-xl backdrop-blur-sm">
              <div className="mb-1 flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-[#0052CC]" />
                <span className="text-xs font-semibold text-slate-300">BUG-4521</span>
                <span className="ml-auto rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-400">
                  ???
                </span>
              </div>
              <p className="text-xs text-slate-400">Button not working (Priority: ???)</p>
            </div>

            {/* Email card */}
            <div className="old-card -rotate-2 rounded-lg border border-orange-500/10 bg-slate-900/80 p-3 shadow-xl backdrop-blur-sm">
              <div className="mb-1 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-600" />
                <span className="text-xs font-semibold text-slate-300">Re: Re: Re: Bug</span>
              </div>
              <p className="text-xs text-slate-400">Still waiting on a fix. Its been 3 days...</p>
            </div>

            {/* Blurry screenshot */}
            <div className="old-card rotate-1 rounded-lg border border-red-500/10 bg-slate-900/80 p-3 shadow-xl backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-slate-600" />
                <span className="text-xs font-semibold text-slate-300">Screenshot_bug.png</span>
              </div>
              <div className="flex h-10 items-center justify-center rounded bg-slate-800 text-[10px] text-slate-600 blur-[2px]">
                [BLURRY — UNREADABLE]
              </div>
            </div>
          </div>
        </div>

        {/* Vertical divider line */}
        <div
          ref={dividerRef}
          className="split-divider relative z-20 flex w-0.5 flex-shrink-0 flex-col items-center"
          style={{ background: 'linear-gradient(to bottom, transparent, #3b82f6, #8b5cf6, transparent)' }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-800 shadow-lg shadow-blue-500/30">
            <div className="h-2 w-0.5 rounded-full bg-gradient-to-b from-red-400 to-blue-400" />
          </div>
        </div>

        {/* NEW WAY — right panel */}
        <div
          ref={rightRef}
          className="right-panel relative flex w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-bl from-blue-950/60 via-[#030712] to-emerald-950/40 px-8 py-12"
          style={{ clipPath: 'inset(0 100% 0 0)' }}
        >
          {/* Blue tint overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-blue-600/10 to-transparent" />

          {/* Label */}
          <div className="relative z-10 mb-6 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              With Support Helper
            </span>
          </div>

          {/* Clean cards */}
          <div className="relative z-10 w-full max-w-xs space-y-3">
            {/* AI Analysis card */}
            <div className="new-card rounded-xl border border-blue-500/30 bg-slate-900/80 p-4 shadow-xl shadow-blue-500/10 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/20">
                  <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-300">AI Analysis</span>
                <span className="ml-auto rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                  15s
                </span>
              </div>
              <p className="text-xs font-medium text-white">Root cause found</p>
              <p className="mt-1 font-mono text-[10px] text-blue-300">
                Line 47: null check missing in handleSubmit()
              </p>
            </div>

            {/* PR Merged card */}
            <div className="new-card rounded-xl border border-emerald-500/30 bg-slate-900/80 p-4 shadow-xl shadow-emerald-500/10 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20">
                  <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-.75" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-slate-300">Pull Request</span>
                <span className="ml-auto rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-400">
                  merged
                </span>
              </div>
              <p className="text-xs font-medium text-white">#892 Fix: null check in handleSubmit</p>
              <p className="mt-1 text-[10px] text-emerald-400">merged 2 minutes ago</p>
            </div>

            {/* Stats row */}
            <div className="new-card grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">15s</p>
                <p className="text-[10px] text-slate-500">to analyze</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-3 text-center">
                <p className="text-lg font-bold text-blue-400">same day</p>
                <p className="text-[10px] text-slate-500">resolution</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Below the split — Title + CTA */}
      <div
        ref={titleRef}
        className="relative z-10 mx-auto max-w-4xl px-4 pb-20 pt-12 text-center sm:px-6 lg:px-8"
      >
        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl" style={{ perspective: '800px' }}>
          {titleWords.map((word, i) => (
            <span
              key={i}
              className={`title-word inline-block ${
                word.highlight === 'red'
                  ? 'bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent'
                  : word.highlight === 'blue'
                    ? 'bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent'
                    : ''
              } ${i < titleWords.length - 1 ? 'mr-[0.22em]' : ''}`}
            >
              {word.text}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle-v2 mx-auto mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl">
          Your users record the bug in one click. AI reads your code and opens the fix.{' '}
          <span className="text-white font-medium">That&apos;s it.</span>
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`${DASHBOARD_URL}/signup`}
            className="hero-cta-v2 group inline-flex h-14 items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-violet-600 to-blue-700 px-8 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/35 hover:scale-[1.02]"
          >
            Try it free — no setup required
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        {/* Sub-text */}
        <p className="hero-cta-v2 mt-4 text-sm text-slate-500">
          Paste one line of code. Get AI-powered bug resolution.
        </p>

        {/* Trust signals */}
        <ul className="hero-cta-v2 mt-6 flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            'No credit card required',
            '5 free AI analyses',
            'Setup in 2 minutes',
          ].map((item) => (
            <li key={item} className="flex items-center gap-1.5 text-sm text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
