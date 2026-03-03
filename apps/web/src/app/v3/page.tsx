'use client';

import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  Film,
  Search,
  GitPullRequest,
  KeyRound,
  Plug,
  Shield,
  Check,
  X,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Code2,
  Video,
  Brain,
  ChevronDown,
} from 'lucide-react';
import { NavBarDark } from '@/components/landing/nav-bar-dark';
import { FooterDark } from '@/components/landing/footer-dark';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Scramble counter — shows random digits then locks to final value
// ---------------------------------------------------------------------------

function ScrambleCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
}: {
  target: string;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [displayed, setDisplayed] = useState('--');
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const chars = '0123456789';
          const totalFrames = Math.floor(duration / 50);
          const lockAt = Math.floor(totalFrames * 0.7);
          let frame = 0;

          const interval = setInterval(() => {
            frame++;
            if (frame >= totalFrames) {
              setDisplayed(target);
              clearInterval(interval);
            } else if (frame >= lockAt) {
              setDisplayed(target);
            } else {
              // Scramble: show random chars of same length as target
              const scrambled = target
                .split('')
                .map((ch) => {
                  if (ch === '%' || ch === 'x' || ch === 's' || ch === '<') return ch;
                  if (ch >= '0' && ch <= '9') {
                    return chars[Math.floor(Math.random() * chars.length)];
                  }
                  return ch;
                })
                .join('');
              setDisplayed(scrambled);
            }
          }, 50);

          return () => clearInterval(interval);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {prefix}
      {displayed}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Live Dashboard Mock Component
// ---------------------------------------------------------------------------

interface ActivityRow {
  id: string;
  ticket: string;
  commit: string;
  pr: string | null;
  time: string;
  status: 'done' | 'analyzing';
}

const INITIAL_ROWS: ActivityRow[] = [
  { id: '1', ticket: 'TK-4521', commit: 'fix(auth): null guard on refresh', pr: '#892', time: '12s ago', status: 'done' },
  { id: '2', ticket: 'TK-4520', commit: 'fix(api): rate limiting headers', pr: '#891', time: '3m ago', status: 'done' },
  { id: '3', ticket: 'TK-4519', commit: 'analyzing: dashboard perf...', pr: null, time: 'now', status: 'analyzing' },
  { id: '4', ticket: 'TK-4518', commit: 'fix(sdk): event handler cleanup', pr: '#890', time: '8m ago', status: 'done' },
];

function LiveDashboard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<ActivityRow[]>(INITIAL_ROWS);
  const [metrics, setMetrics] = useState({ reported: 12, resolved: 11, prs: 8, avgTime: 14.2 });
  const [progressWidth, setProgressWidth] = useState(0);
  const rowsAnimatedRef = useRef(false);

  // Count up metrics with GSAP
  useGSAP(
    () => {
      const card = cardRef.current;
      if (!card) return;

      // Animate progress bar
      gsap.to(
        {},
        {
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: function () {
            setProgressWidth(Math.round(this.progress() * 91.7));
          },
          scrollTrigger: {
            trigger: card,
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Slide in rows
      if (!rowsAnimatedRef.current) {
        gsap.from('.dash-row', {
          opacity: 0,
          x: -20,
          stagger: 0.12,
          duration: 0.5,
          ease: 'power2.out',
          delay: 0.4,
          scrollTrigger: {
            trigger: card,
            start: 'top 75%',
            toggleActions: 'play none none none',
            onEnter: () => { rowsAnimatedRef.current = true; },
          },
        });
      }

      // Count up metric numbers
      const targets = [
        { key: 'reported' as const, end: 12 },
        { key: 'resolved' as const, end: 11 },
        { key: 'prs' as const, end: 8 },
      ];

      targets.forEach(({ key, end }) => {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: end,
          duration: 1.5,
          ease: 'power2.out',
          onUpdate: () => {
            setMetrics((prev) => ({ ...prev, [key]: Math.round(obj.val) }));
          },
          scrollTrigger: {
            trigger: card,
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        });
      });
    },
    { scope: cardRef }
  );

  // Simulate live "TK-4519 analyzed" after a few seconds
  useEffect(() => {
    const t = setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === '3'
            ? { ...r, commit: 'fix(dashboard): memo on heavy component', pr: '#893', time: 'just now', status: 'done' }
            : r
        )
      );
      setMetrics((prev) => ({ ...prev, resolved: 12, prs: 9 }));
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={cardRef}
      className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-blue-500/10 backdrop-blur-sm"
    >
      {/* Dashboard header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-semibold text-white">Support Helper Dashboard</span>
        </div>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
          Today
        </span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-px border-b border-white/5 bg-white/5">
        {[
          { label: 'reported', value: metrics.reported, color: 'text-white' },
          { label: 'resolved', value: metrics.resolved, color: 'text-emerald-400' },
          { label: 'PRs open', value: metrics.prs, color: 'text-blue-400' },
          { label: 'avg time', value: `${metrics.avgTime}s`, color: 'text-violet-400' },
        ].map((m) => (
          <div key={m.label} className="bg-[#030712] px-4 py-4">
            <p className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Activity */}
      <div className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Recent Activity
        </p>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="dash-row flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5 transition-colors"
            >
              {row.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-400" />
              )}
              <span className="w-16 flex-shrink-0 font-mono text-xs font-medium text-slate-400">
                {row.ticket}
              </span>
              <span className="flex-1 truncate text-xs text-slate-300">{row.commit}</span>
              {row.pr && (
                <span className="flex-shrink-0 rounded-md bg-violet-500/10 px-2 py-0.5 font-mono text-xs text-violet-400">
                  PR {row.pr}
                </span>
              )}
              <span className="flex-shrink-0 text-xs text-slate-600">{row.time}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-slate-500">Auto-resolved</span>
            <span className="font-semibold text-emerald-400">{progressWidth.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-75"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------

function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Animated blobs
      gsap.to('.v3-blob-1', { y: -50, x: 25, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.v3-blob-2', { y: 40, x: -30, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.v3-blob-3', { y: -30, x: 20, duration: 6, repeat: -1, yoyo: true, ease: 'sine.inOut' });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.v3-stats', { opacity: 0, y: 40, stagger: 0.1, duration: 0.6 })
        .from('.v3-title .v3-word', { opacity: 0, y: 60, rotationX: -40, stagger: 0.07, duration: 0.7 }, '-=0.3')
        .from('.v3-subtitle', { opacity: 0, y: 20, duration: 0.5 }, '-=0.3')
        .from('.v3-cta-btn', { opacity: 0, y: 16, scale: 0.96, stagger: 0.1, duration: 0.45 }, '-=0.2');
    },
    { scope: sectionRef }
  );

  const titleParts = [
    { text: 'AI that doesn\'t just', gradient: false },
    { text: 'find', gradient: true },
    { text: 'bugs.', gradient: false },
    { text: 'It', gradient: false },
    { text: 'fixes', gradient: true },
    { text: 'them.', gradient: false },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-[#030712] pb-24 pt-28"
    >
      {/* Animated mesh blobs */}
      <div className="v3-blob-1 pointer-events-none absolute -left-60 -top-40 h-[700px] w-[700px] rounded-full bg-blue-600/20 blur-[140px]" />
      <div className="v3-blob-2 pointer-events-none absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="v3-blob-3 pointer-events-none absolute bottom-10 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-purple-600/10 blur-[100px]" />

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,#030712_75%)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Big stats above title */}
          <div className="mb-14 flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-16">
            {[
              { value: '95', suffix: '%', label: 'faster resolution' },
              { value: '12', suffix: 'x', label: 'fewer open bugs' },
              { value: '<15', suffix: 's', label: 'avg. fix time' },
            ].map((stat) => (
              <div key={stat.label} className="v3-stats text-center">
                <p className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-7xl font-black leading-none tracking-tight text-transparent sm:text-8xl">
                  <ScrambleCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-2 text-sm font-medium text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Title */}
          <h1 className="v3-title text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
            {titleParts.map((part, i) => (
              <span
                key={i}
                className={`v3-word inline-block ${
                  part.gradient
                    ? 'bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent'
                    : ''
                } ${i < titleParts.length - 1 ? 'mr-[0.22em]' : ''}`}
              >
                {part.text}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p className="v3-subtitle mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            From video report to merged Pull Request. Fully automated. Works while you sleep.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="v3-cta-btn group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/40"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start free — 5 analyses/month
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-violet-500 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
            <a
              href="mailto:demo@supporthelper.io"
              className="v3-cta-btn inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
            >
              Book a demo
            </a>
          </div>
        </div>

        {/* Live Dashboard */}
        <LiveDashboard />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Logos / Trusted By Section
// ---------------------------------------------------------------------------

function LogosV3() {
  return (
    <section className="relative border-y border-white/5 bg-[#030712] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
          Trusted by 500+ engineering teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {['Acme Corp', 'Startup Labs', 'TechVentures', 'DevStudio', 'BuildFast', 'CodeCraft'].map(
            (company) => (
              <div
                key={company}
                className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2"
              >
                <span className="text-sm font-semibold text-slate-400">{company}</span>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How It Works Section
// ---------------------------------------------------------------------------

const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    icon: Code2,
    title: 'Integrate',
    description: 'Add SDK with one line of code',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    glow: 'shadow-blue-500/10',
  },
  {
    number: '02',
    icon: Video,
    title: 'Capture',
    description: 'Users record the bug in-app',
    gradient: 'from-violet-500/20 to-purple-500/20',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    glow: 'shadow-violet-500/10',
  },
  {
    number: '03',
    icon: Brain,
    title: 'Analyze',
    description: 'AI investigates your codebase',
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'shadow-amber-500/10',
  },
  {
    number: '04',
    icon: GitPullRequest,
    title: 'Fix',
    description: 'Receive a PR with the fix',
    gradient: 'from-emerald-500/20 to-cyan-500/20',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
  },
];

function HowItWorksV3() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.hiw-step', {
        opacity: 0,
        y: 50,
        stagger: 0.15,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.hiw-connector', {
        scaleX: 0,
        transformOrigin: 'left center',
        stagger: 0.15,
        duration: 0.5,
        ease: 'power2.inOut',
        delay: 0.4,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#0a0f1e] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            From bug report to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              PR in minutes.
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div key={step.number} className="hiw-step relative flex flex-col">
              {/* Connector line (hidden on last item) */}
              {index < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="hiw-connector absolute right-0 top-10 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-white/10 to-white/5 lg:block lg:translate-x-full" />
              )}

              <div
                className={`flex flex-1 flex-col rounded-2xl border bg-gradient-to-b ${step.gradient} ${step.border} p-6 shadow-xl ${step.glow}`}
              >
                {/* Step number */}
                <span className="mb-4 font-mono text-xs font-bold tracking-widest text-slate-600">
                  {step.number}
                </span>

                {/* Icon */}
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/5 ${step.iconBg} ${step.iconColor}`}
                >
                  <step.icon className="h-6 w-6" />
                </div>

                {/* Content */}
                <h3 className="text-base font-bold text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ROI Calculator Section
// ---------------------------------------------------------------------------

function RoiCalculator() {
  const sectionRef = useRef<HTMLElement>(null);
  const [bugs, setBugs] = useState(50);

  const hoursSaved = Math.round(bugs * 0.5);
  const costSaved = bugs * 75;
  const roi = Math.round((costSaved / 79) * 100);

  useGSAP(
    () => {
      gsap.from('.roi-card', {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">ROI</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Calculate your{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              ROI
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            See how much time and money you save with AI-powered bug resolution.
          </p>
        </div>

        <div className="roi-card mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
          <div className="p-8 sm:p-10">
            {/* Slider */}
            <div className="mb-8">
              <div className="mb-4 flex items-baseline justify-between">
                <label className="text-sm font-semibold text-slate-300">
                  Bugs per month
                </label>
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-3xl font-black text-transparent">
                  {bugs}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={bugs}
                onChange={(e) => setBugs(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500"
              />
              <div className="mt-1.5 flex justify-between text-xs text-slate-600">
                <span>10</span>
                <span>500</span>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  label: 'Hours saved',
                  value: `${hoursSaved}h`,
                  sub: 'per month',
                  color: 'from-blue-400 to-cyan-400',
                },
                {
                  label: 'Cost saved',
                  value: `$${costSaved.toLocaleString()}`,
                  sub: 'per month',
                  color: 'from-violet-400 to-purple-400',
                },
                {
                  label: 'ROI',
                  value: `${roi}%`,
                  sub: 'vs Pro plan',
                  color: 'from-emerald-400 to-cyan-400',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-5 text-center"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {item.label}
                  </p>
                  <p
                    className={`mt-2 bg-gradient-to-r ${item.color} bg-clip-text text-4xl font-black text-transparent tabular-nums`}
                  >
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{item.sub}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-slate-600">
              Assumes 30 min saved per bug at $150/hr dev rate. Compared to Pro plan at $79/mo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features Section
// ---------------------------------------------------------------------------

const V3_FEATURES = [
  {
    icon: Film,
    title: 'Video Capture + AI Vision',
    description:
      'Users record bugs in-app. AI extracts frames, OCR, and console errors automatically.',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    border: 'hover:border-blue-500/30',
  },
  {
    icon: Search,
    title: 'Deep Code Investigation',
    description:
      'AI reads your codebase, traces execution paths, and pinpoints the root cause.',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    border: 'hover:border-violet-500/30',
  },
  {
    icon: GitPullRequest,
    title: 'Auto-fix PR Generation',
    description:
      'AI writes the fix and opens a Pull Request in your repository. Done.',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    border: 'hover:border-emerald-500/30',
  },
  {
    icon: KeyRound,
    title: 'BYOK — Your Keys, Your Data',
    description:
      'Use OpenAI, Claude, or Gemini. Data goes to your provider, not us.',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    border: 'hover:border-amber-500/30',
  },
  {
    icon: Plug,
    title: 'Full Integration Suite',
    description:
      'GitHub, Jira, Slack, Notion, HubSpot. Sync everywhere automatically.',
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/10',
    border: 'hover:border-pink-500/30',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'AES-256 encryption, SSO/SAML, audit logs, SOC 2 ready.',
    iconColor: 'text-slate-300',
    iconBg: 'bg-slate-500/10',
    border: 'hover:border-slate-500/30',
  },
];

function FeaturesV3() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v3-feature-card', {
        opacity: 0,
        y: 40,
        stagger: {
          amount: 0.5,
          grid: [3, 2],
          from: 'start',
        },
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#0a0f1e] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Everything from{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              capture to fix
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            A complete AI platform — no duct tape, no 10-tab browser windows.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2">
          {V3_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`v3-feature-card group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 ${feature.border} hover:bg-white/[0.04]`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/5 ${feature.iconBg} ${feature.iconColor}`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Integrations Band (Marquee)
// ---------------------------------------------------------------------------

const INTEGRATIONS = [
  'GitHub',
  'Jira',
  'Slack',
  'Notion',
  'HubSpot',
  'Linear',
  'GitLab',
  'Custom API',
];

function IntegrationsBand() {
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track) return;

      const totalWidth = track.scrollWidth / 2;
      gsap.to(track, {
        x: -totalWidth,
        duration: 25,
        ease: 'none',
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x: number) => parseFloat(String(x)) % totalWidth),
        },
      });
    },
    { scope: trackRef }
  );

  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-[#030712] py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Integrates with your entire stack
        </p>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#030712] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#030712] to-transparent" />

        <div ref={trackRef} className="flex gap-4 whitespace-nowrap">
          {[...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex h-10 flex-shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] px-6"
            >
              <span className="text-sm font-semibold text-slate-400">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing Section V3
// ---------------------------------------------------------------------------

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  featured: boolean;
  features: string[];
  notIncluded?: string[];
}

const V3_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mo',
    description: 'Perfect for side projects and small teams getting started.',
    cta: 'Start Free',
    ctaHref: `${DASHBOARD_URL}/signup`,
    featured: false,
    features: [
      '5 analyses/month',
      'Gemini Flash model',
      'Video capture & analysis',
      '1 application',
      'Community support',
    ],
    notIncluded: ['Deep code analysis', 'Auto-fix PRs', 'Integrations'],
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    description: 'Everything your team needs to ship faster with AI.',
    cta: 'Start 14-day Trial',
    ctaHref: `${DASHBOARD_URL}/signup?plan=pro`,
    featured: true,
    features: [
      'Unlimited analyses (BYOK)',
      'GPT-4, Claude, Gemini support',
      'Deep code investigation',
      'Auto-fix PR generation',
      'Unlimited applications',
      'GitHub, Jira, Slack, Notion',
      'Email & chat support',
    ],
  },
  {
    name: 'Enterprise',
    price: '$249',
    period: '/mo',
    description: 'For orgs needing SSO, dedicated infra, and premium SLA.',
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@supporthelper.io',
    featured: false,
    features: [
      'Everything in Pro',
      'Dedicated AI infrastructure',
      'SSO / SAML authentication',
      'Dedicated account manager',
      'Custom integrations',
      'Priority support & 99.9% SLA',
      'Audit logs & compliance',
    ],
  },
];

function PricingV3() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v3-pricing-card', {
        opacity: 0,
        y: 60,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} id="pricing" className="relative bg-[#030712] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* Glow behind cards */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[120px]" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Simple,{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              transparent
            </span>{' '}
            pricing
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Start free. No credit card required. Scale as you grow.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-3">
          {V3_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`v3-pricing-card relative flex flex-col overflow-hidden rounded-2xl border p-8 transition-all duration-300 ${
                tier.featured
                  ? 'border-blue-500/40 bg-gradient-to-b from-blue-500/10 via-violet-500/5 to-transparent shadow-2xl shadow-blue-500/20 lg:scale-105'
                  : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              {/* Featured top gradient line */}
              {tier.featured && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              )}

              {/* Badge */}
              {tier.featured && (
                <div className="mb-4 inline-flex w-fit items-center rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/30">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-bold text-white">{tier.name}</h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className={`text-5xl font-black ${
                    tier.featured
                      ? 'bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent'
                      : 'text-white'
                  }`}
                >
                  {tier.price}
                </span>
                <span className="text-sm text-slate-500">{tier.period}</span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-400">{tier.description}</p>

              <a
                href={tier.ctaHref}
                className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                  tier.featured
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40'
                    : 'border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4" />
              </a>

              <div className="mt-8 flex-1 border-t border-white/5 pt-6">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                  {tier.notIncluded?.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-700" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* BYOK note */}
        <p className="mx-auto mt-10 max-w-lg text-center text-sm text-slate-600">
          <span className="font-medium text-slate-400">BYOK</span> = Bring Your Own Key.
          Your AI API keys go directly to your chosen provider — we never see your data.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Testimonials Section
// ---------------------------------------------------------------------------

const TESTIMONIALS = [
  {
    quote:
      'We reduced our bug resolution time by 90%. Support Helper pays for itself in the first week.',
    name: 'Sarah Chen',
    role: 'CTO @ StartupLabs',
    initials: 'SC',
    avatarBg: 'bg-violet-500/20',
    avatarColor: 'text-violet-300',
    avatarBorder: 'border-violet-500/30',
  },
  {
    quote:
      'The auto-fix PR feature is magic. Our team focuses on features instead of debugging.',
    name: 'Marcus Johnson',
    role: 'Lead Dev @ TechVentures',
    initials: 'MJ',
    avatarBg: 'bg-blue-500/20',
    avatarColor: 'text-blue-300',
    avatarBorder: 'border-blue-500/30',
  },
  {
    quote:
      'Bug reports that actually contain useful information. The AI analysis is scarily accurate.',
    name: 'Elena Rodriguez',
    role: 'VP Engineering @ BuildFast',
    initials: 'ER',
    avatarBg: 'bg-emerald-500/20',
    avatarColor: 'text-emerald-300',
    avatarBorder: 'border-emerald-500/30',
  },
];

function TestimonialsV3() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v3-testimonial-card', {
        opacity: 0,
        y: 40,
        stagger: 0.15,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Social Proof
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Teams shipping faster with{' '}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              Support Helper
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="v3-testimonial-card flex flex-col rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
            >
              {/* Quote */}
              <p className="flex-1 text-sm leading-relaxed text-slate-300">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Attribution */}
              <div className="mt-6 flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border ${t.avatarBorder} ${t.avatarBg}`}
                >
                  <span className={`text-xs font-bold ${t.avatarColor}`}>{t.initials}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Security Section
// ---------------------------------------------------------------------------

function SecuritySection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v3-security-item', {
        opacity: 0,
        y: 30,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  const items = [
    { icon: '🔒', title: 'AES-256-GCM', sub: 'API keys encrypted at rest' },
    { icon: '🛡️', title: 'SOC 2 Ready', sub: 'Compliance built in' },
    { icon: '🔑', title: 'SSO / SAML', sub: 'Enterprise authentication' },
    { icon: '📋', title: 'Audit Logs', sub: 'Full activity tracking' },
  ];

  return (
    <section ref={sectionRef} className="relative bg-[#0a0f1e] py-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Enterprise-grade security
          </h2>
          <p className="mt-3 text-slate-400">
            Built for teams where security is non-negotiable.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="v3-security-item rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center transition-colors hover:border-white/10"
            >
              <span className="text-3xl">{item.icon}</span>
              <p className="mt-3 font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ Section
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    question: 'What is BYOK?',
    answer:
      'BYOK stands for "Bring Your Own Key." Instead of routing your data through our AI infrastructure, you provide your own API key from OpenAI, Anthropic, Google, AWS Bedrock, or Ollama. Your data goes directly to your chosen provider — we never see it.',
  },
  {
    question: 'How does the Starter tier work?',
    answer:
      'The Starter tier is completely free and gives you 5 AI analyses per month. Each analysis covers video capture, frame extraction, OCR, and GPT-4 Vision processing of a bug report. No credit card required to get started.',
  },
  {
    question: 'Can I change plans?',
    answer:
      'Yes, you can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the end of your current billing period. There are no long-term contracts or lock-in — cancel whenever you want.',
  },
  {
    question: 'Is my API key secure?',
    answer:
      'All API keys are encrypted at rest using AES-256-GCM before being stored in our database. Keys are only decrypted in memory when processing a request and are never logged or exposed in responses.',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'Support Helper supports Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google), Amazon Bedrock, and Ollama for self-hosted models. You can switch providers at any time from your dashboard settings.',
  },
];

function FaqV3() {
  const sectionRef = useRef<HTMLElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useGSAP(
    () => {
      gsap.from('.faq-item', {
        opacity: 0,
        y: 24,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Frequently asked{' '}
            <span className="bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">
              questions
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-12 max-w-2xl divide-y divide-white/5">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="faq-item">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-white"
                  aria-expanded={isOpen}
                >
                  <span className={`text-base font-semibold ${isOpen ? 'text-white' : 'text-slate-300'}`}>
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-slate-500 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="pb-5 text-sm leading-relaxed text-slate-400">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CTA Section
// ---------------------------------------------------------------------------

function CtaSectionV3() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v3-cta-card', {
        opacity: 0,
        y: 60,
        scale: 0.97,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });

      // Animate blobs inside the CTA card
      gsap.to('.cta-blob-1', { x: 20, y: -15, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.cta-blob-2', { x: -25, y: 20, duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="v3-cta-card relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-violet-500/5 to-purple-500/10 p-12 text-center sm:p-16">
          {/* Animated background blobs */}
          <div className="cta-blob-1 pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-600/20 blur-[80px]" />
          <div className="cta-blob-2 pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-violet-600/20 blur-[80px]" />

          {/* Top line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              500+ teams already shipping faster
            </div>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              See your bugs{' '}
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                disappear.
              </span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-lg text-slate-400">
              Join 500+ teams already shipping faster with AI. Start free — no credit card required.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={`${DASHBOARD_URL}/signup`}
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-white px-8 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="mailto:demo@supporthelper.io"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
              >
                Schedule Demo
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
              {[
                'No credit card required',
                'Setup in 5 minutes',
                '5 free AI analyses/month',
                'Cancel anytime',
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-sm text-slate-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function V3Page() {
  return (
    <div className="flex min-h-screen flex-col bg-[#030712]">
      <NavBarDark />
      <main className="flex-1">
        <HeroSection />
        <LogosV3 />
        <HowItWorksV3 />
        <RoiCalculator />
        <FeaturesV3 />
        <IntegrationsBand />
        <PricingV3 />
        <TestimonialsV3 />
        <SecuritySection />
        <FaqV3 />
        <CtaSectionV3 />
      </main>
      <FooterDark />
    </div>
  );
}
