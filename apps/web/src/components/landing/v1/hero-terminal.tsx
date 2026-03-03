'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Play, CheckCircle2 } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

// ─── Animated counter ────────────────────────────────────────────────────────
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

// ─── Terminal line types ──────────────────────────────────────────────────────
interface TerminalLine {
  id: number;
  type: 'command' | 'step' | 'result' | 'success' | 'blank';
  text: string;
  subtext?: string;
  timing?: string;
}

const TERMINAL_LINES: TerminalLine[] = [
  { id: 0, type: 'command', text: '$ supporthelper analyze --ticket TK-4521' },
  { id: 1, type: 'blank', text: '' },
  { id: 2, type: 'step', text: 'Extracting 12 keyframes from video...', timing: '2.1s' },
  { id: 3, type: 'step', text: 'Running OCR on screenshots...', timing: '1.4s' },
  { id: 4, type: 'step', text: 'Analyzing with GPT-4 Vision...', timing: '8.7s' },
  { id: 5, type: 'step', text: 'Investigating codebase: src/auth/login.ts', timing: '3.2s' },
  { id: 6, type: 'result', text: 'Root cause: null check missing at line 47' },
  { id: 7, type: 'blank', text: '' },
  { id: 8, type: 'success', text: '→ Opening PR #892: "fix(auth): add null guard in login flow"' },
  { id: 9, type: 'blank', text: '' },
  { id: 10, type: 'success', text: '✨ Bug resolved. Total time: 15.4s' },
];

// ─── Terminal window ──────────────────────────────────────────────────────────
function TerminalWindow() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          runAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function runAnimation() {
    let delay = 300;

    TERMINAL_LINES.forEach((line) => {
      // Show the line
      const showDelay = delay;
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, line.id]);
      }, showDelay);

      // For step lines: mark as complete after extra delay
      if (line.type === 'step' && line.timing) {
        const completionDelay = delay + 900;
        setTimeout(() => {
          setCompletedSteps((prev) => [...prev, line.id]);
        }, completionDelay);
        delay += 1100;
      } else if (line.type === 'blank') {
        delay += 80;
      } else if (line.type === 'command') {
        delay += 500;
      } else {
        delay += 400;
      }
    });
  }

  return (
    <div ref={terminalRef} className="hero-mockup mx-auto mt-20 max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/60">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#111111] px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-4 flex h-6 items-center rounded-md bg-[#1a1a1a] px-3">
            <span className="font-mono text-xs text-slate-500">Terminal</span>
          </div>
        </div>

        {/* Terminal body */}
        <div className="min-h-[300px] p-6 font-mono text-sm">
          {TERMINAL_LINES.map((line) => {
            const isVisible = visibleLines.includes(line.id);
            const isCompleted = completedSteps.includes(line.id);

            if (!isVisible) return null;

            if (line.type === 'blank') {
              return <div key={line.id} className="h-2" />;
            }

            if (line.type === 'command') {
              return (
                <div key={line.id} className="mb-3 flex items-center">
                  <span className="text-emerald-400">{line.text}</span>
                  <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-emerald-400 align-middle" />
                </div>
              );
            }

            if (line.type === 'step') {
              return (
                <div key={line.id} className="mb-1.5 flex items-center gap-3 pl-2">
                  {isCompleted ? (
                    <span className="text-emerald-400">✔</span>
                  ) : (
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border border-blue-400 border-t-transparent text-xs leading-none"
                      aria-hidden="true"
                    />
                  )}
                  <span className={isCompleted ? 'text-slate-300' : 'text-slate-400'}>
                    {line.text}
                  </span>
                  {isCompleted && line.timing && (
                    <span className="ml-auto text-xs text-emerald-500/70">
                      ✔ done ({line.timing})
                    </span>
                  )}
                </div>
              );
            }

            if (line.type === 'result') {
              return (
                <div key={line.id} className="mb-1.5 pl-2">
                  <span className="text-amber-300">{line.text}</span>
                </div>
              );
            }

            if (line.type === 'success') {
              const isResolvedLine = line.text.startsWith('✨');
              return (
                <div key={line.id} className="mb-1 pl-2">
                  <span
                    className={
                      isResolvedLine
                        ? 'bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text font-semibold text-transparent'
                        : 'text-blue-300'
                    }
                  >
                    {line.text}
                  </span>
                </div>
              );
            }

            return null;
          })}

          {/* Empty state before animation */}
          {visibleLines.length === 0 && (
            <div className="flex items-center text-slate-600">
              <span className="text-emerald-600">$ </span>
              <span className="ml-2 inline-block h-[1em] w-[2px] animate-pulse bg-emerald-600 align-middle" />
            </div>
          )}
        </div>
      </div>

      {/* Reflection */}
      <div className="mx-8 h-16 rounded-b-3xl bg-gradient-to-b from-white/[0.02] to-transparent blur-sm" />
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  { value: 10000, suffix: '+', label: 'Bugs resolved' },
  { value: 500, suffix: '+', label: 'Teams using it' },
  { value: 95, suffix: '%', label: 'Faster resolution' },
];

// ─── Hero section ─────────────────────────────────────────────────────────────
export function HeroTerminal() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Floating orbs
      gsap.to('.v1-orb-1', {
        y: -40,
        x: 20,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.v1-orb-2', {
        y: 30,
        x: -25,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.v1-orb-3', {
        y: -20,
        x: 15,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // Entrance sequence
      tl.from('.v1-badge', { opacity: 0, y: 30, duration: 0.6 })
        .from(
          '.v1-title .v1-word',
          {
            opacity: 0,
            y: 60,
            rotationX: -40,
            stagger: 0.09,
            duration: 0.7,
          },
          '-=0.2'
        )
        .from('.v1-subtitle', { opacity: 0, y: 25, duration: 0.5 }, '-=0.3')
        .from(
          '.v1-cta-btn',
          { opacity: 0, y: 20, scale: 0.95, stagger: 0.1, duration: 0.5 },
          '-=0.2'
        )
        .from(
          '.v1-highlight',
          { opacity: 0, y: 15, stagger: 0.06, duration: 0.4 },
          '-=0.2'
        )
        .from(
          '.hero-mockup',
          { opacity: 0, y: 80, scale: 0.92, duration: 1, ease: 'power2.out' },
          '-=0.4'
        )
        .from(
          '.v1-stat',
          { opacity: 0, y: 20, stagger: 0.1, duration: 0.5 },
          '-=0.5'
        );
    },
    { scope: containerRef }
  );

  // Title words — words with gradient get special treatment
  const titleLines = [
    { words: ['Your', 'users', 'film', 'the', 'bug.'] },
    { words: ['Your', 'AI', 'ships', 'the', 'fix.'] },
  ];

  const gradientWords = new Set(['AI', 'fix.']);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-[#030712] pb-24 pt-24 sm:pt-32"
    >
      {/* Gradient orbs */}
      <div className="v1-orb-1 pointer-events-none absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-600/15 blur-[140px]" />
      <div className="v1-orb-2 pointer-events-none absolute -right-32 top-1/4 h-[450px] w-[450px] rounded-full bg-emerald-600/10 blur-[120px]" />
      <div className="v1-orb-3 pointer-events-none absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-cyan-500/8 blur-[120px]" />

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Radial fade over grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,transparent_0%,#030712_75%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">

          {/* Badge */}
          <div className="v1-badge mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-sm font-medium text-slate-300 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Open source · Self-hostable · BYOK
          </div>

          {/* Title */}
          <h1 className="v1-title text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-[5.5rem] xl:leading-[1.05]">
            {titleLines.map((line, lineIdx) => (
              <span key={lineIdx} className="block">
                {line.words.map((word, wordIdx) => (
                  <span
                    key={wordIdx}
                    className={`v1-word inline-block ${
                      gradientWords.has(word)
                        ? 'bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent'
                        : ''
                    } ${wordIdx < line.words.length - 1 ? 'mr-[0.22em]' : ''}`}
                  >
                    {word}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p className="v1-subtitle mx-auto mt-6 max-w-2xl text-base text-slate-400 sm:text-lg">
            One SDK. Zero triage. AI investigates your codebase, finds the root cause, and opens a
            PR — automatically.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="v1-cta-btn group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/35"
            >
              <span className="relative z-10 flex items-center gap-2">
                Deploy in 5 minutes
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            <a
              href="mailto:demo@supporthelper.io"
              className="v1-cta-btn inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-8 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
            >
              <Play className="h-4 w-4" />
              See it in action
            </a>
          </div>

          {/* Highlights */}
          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              'No credit card',
              '5 free analyses/mo',
              'Any JS framework',
              'Works with GitHub',
            ].map((item) => (
              <li
                key={item}
                className="v1-highlight flex items-center gap-1.5 text-sm text-slate-500"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Terminal animation */}
        <TerminalWindow />

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="v1-stat text-center">
              <p className="text-3xl font-bold text-white sm:text-4xl">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
