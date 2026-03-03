'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Play, CheckCircle2 } from 'lucide-react';

gsap.registerPlugin();

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const STATS = [
  { value: 10000, suffix: '+', label: 'Bugs resolved' },
  { value: 500, suffix: '+', label: 'Teams using it' },
  { value: 95, suffix: '%', label: 'Faster resolution' },
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const obj = { val: 0 };
          gsap.to(obj, {
            val: value,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => setDisplayed(Math.round(obj.val)),
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {displayed.toLocaleString()}
      {suffix}
    </span>
  );
}

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Floating orbs
      gsap.to('.orb-1', {
        y: -40,
        x: 20,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.orb-2', {
        y: 30,
        x: -25,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.orb-3', {
        y: -20,
        x: 15,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // Main entrance sequence
      tl.from('.hero-badge', { opacity: 0, y: 30, duration: 0.6 })
        .from(
          '.hero-title .word',
          {
            opacity: 0,
            y: 60,
            rotationX: -40,
            stagger: 0.08,
            duration: 0.7,
          },
          '-=0.2'
        )
        .from('.hero-subtitle', { opacity: 0, y: 25, duration: 0.5 }, '-=0.3')
        .from('.hero-desc', { opacity: 0, y: 20, duration: 0.5 }, '-=0.3')
        .from(
          '.hero-cta-btn',
          { opacity: 0, y: 20, scale: 0.95, stagger: 0.1, duration: 0.5 },
          '-=0.2'
        )
        .from(
          '.hero-highlight',
          { opacity: 0, y: 15, stagger: 0.05, duration: 0.4 },
          '-=0.2'
        )
        .from(
          '.hero-mockup',
          { opacity: 0, y: 80, scale: 0.9, duration: 1, ease: 'power2.out' },
          '-=0.5'
        )
        .from(
          '.hero-stat',
          { opacity: 0, y: 20, stagger: 0.1, duration: 0.5 },
          '-=0.5'
        );
    },
    { scope: containerRef }
  );

  // 3D tilt on mockup
  useEffect(() => {
    const el = mockupRef.current;
    if (!el) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateX = ((e.clientY - centerY) / rect.height) * -8;
      const rotateY = ((e.clientX - centerX) / rect.width) * 8;

      gsap.to(el, {
        rotateX,
        rotateY,
        duration: 0.5,
        ease: 'power2.out',
        transformPerspective: 1000,
      });
    };

    const handleLeave = () => {
      gsap.to(el, {
        rotateX: 0,
        rotateY: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.5)',
      });
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  const titleWords = ['Film', 'the', 'bug.', 'AI', 'finds', 'the', 'fix.'];

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-[#030712] pb-20 pt-24 sm:pt-32"
    >
      {/* Gradient orbs */}
      <div className="orb-1 pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="orb-2 pointer-events-none absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px]" />
      <div className="orb-3 pointer-events-none absolute bottom-0 left-1/3 h-[350px] w-[350px] rounded-full bg-indigo-500/10 blur-[100px]" />

      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Radial fade for grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#030712_70%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="hero-badge mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-slate-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Now with autonomous PR generation
          </div>

          {/* Title */}
          <h1 className="hero-title text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-8xl">
            {titleWords.map((word, i) => (
              <span
                key={i}
                className={`word inline-block ${
                  word === 'AI' || word === 'fix.'
                    ? 'bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent'
                    : ''
                } ${i < titleWords.length - 1 ? 'mr-[0.25em]' : ''}`}
              >
                {word}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle mt-6 text-xl text-slate-300 sm:text-2xl">
            AI-Powered Bug Resolution for Modern Teams
          </p>

          {/* Description */}
          <p className="hero-desc mx-auto mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            Your users record bugs in-app with one click. Our AI investigates your codebase,
            pinpoints the root cause, and opens a Pull Request with the fix.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="hero-cta-btn group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-violet-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            <a
              href="mailto:demo@supporthelper.io"
              className="hero-cta-btn inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </a>
          </div>

          {/* Highlights */}
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              'No credit card required',
              '5 free AI analyses/month',
              'Setup in 5 minutes',
              'Works with any JS framework',
            ].map((item) => (
              <li
                key={item}
                className="hero-highlight flex items-center gap-1.5 text-sm text-slate-400"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Browser Mockup */}
        <div
          ref={mockupRef}
          className="hero-mockup mx-auto mt-20 max-w-3xl"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-slate-800/50 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="mx-auto flex h-7 w-64 items-center justify-center rounded-md bg-slate-700/50 text-xs text-slate-400">
                yourapp.com
              </div>
            </div>

            {/* App content simulation */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 sm:p-12">
              <div className="flex flex-col items-center gap-8 text-center">
                {/* Widget mockup */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
                    <svg
                      className="h-10 w-10 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                  </div>
                  {/* Pulse ring */}
                  <div className="absolute inset-0 animate-ping rounded-2xl bg-blue-500/20" style={{ animationDuration: '2s' }} />
                </div>

                <div>
                  <p className="text-xl font-semibold text-white">Bug detected?</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Click to record and let AI do the rest
                  </p>
                </div>

                {/* Record button */}
                <button className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500 px-8 text-sm font-medium text-white shadow-lg shadow-red-500/30 transition-transform hover:scale-105">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Start Recording
                </button>

                {/* AI Analysis panel */}
                <div className="w-full max-w-sm rounded-xl border border-white/5 bg-slate-800/60 p-5 text-left backdrop-blur-sm">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-blue-400">
                    AI Analysis
                  </p>
                  {[
                    { label: 'Extracting video frames', done: true },
                    { label: 'Running OCR on screenshots', done: true },
                    { label: 'Analyzing with GPT-4 Vision', done: true },
                    { label: 'Investigating codebase', progress: true },
                  ].map((item) => (
                    <div key={item.label} className="mb-3 flex items-center gap-3 last:mb-0">
                      {'done' in item ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                      ) : (
                        <div className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                      )}
                      <span
                        className={`text-sm ${'done' in item ? 'text-slate-300' : 'text-blue-300'}`}
                      >
                        {item.label}
                      </span>
                      {'done' in item && (
                        <span className="ml-auto text-xs text-slate-500">done</span>
                      )}
                    </div>
                  ))}

                  {/* Progress bar */}
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                      style={{ width: '75%', animation: 'pulse 2s ease-in-out infinite' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reflection */}
          <div className="mx-8 h-20 rounded-b-3xl bg-gradient-to-b from-white/[0.02] to-transparent blur-sm" />
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="hero-stat text-center">
              <p className="text-3xl font-bold text-white sm:text-4xl">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
