'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import {
  ArrowRight,
  Circle,
  Check,
  AlertTriangle,
  Bug,
  GitBranch,
} from 'lucide-react';

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

/* ───────── tiny inline SVG icons (avoid extra imports) ───────── */
const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6 text-white">
    <circle cx={12} cy={12} r={10} />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <line x1={12} y1={17} x2={12.01} y2={17} />
  </svg>
);
const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
    <rect x={2} y={2} width={20} height={20} rx={2.18} ry={2.18} />
    <line x1={7} y1={2} x2={7} y2={22} />
    <line x1={17} y1={2} x2={17} y2={22} />
    <line x1={2} y1={12} x2={22} y2={12} />
    <line x1={2} y1={7} x2={7} y2={7} />
    <line x1={2} y1={17} x2={7} y2={17} />
    <line x1={17} y1={17} x2={22} y2={17} />
    <line x1={17} y1={7} x2={22} y2={7} />
  </svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <line x1={22} y1={2} x2={11} y2={13} />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export function HeroLiveDemo() {
  const sectionRef = useRef<HTMLElement>(null);
  const browserRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!browserRef.current) return;

    const ctx = gsap.context(() => {
      /* ── reset everything hidden ── */
      gsap.set('.demo-fab', { scale: 0, opacity: 0 });
      gsap.set('.demo-cursor', { opacity: 0, x: 300, y: 400 });
      gsap.set('.demo-widget', { scale: 0, opacity: 0, transformOrigin: 'bottom right' });
      gsap.set('.demo-start-view', { opacity: 1 });
      gsap.set('.demo-recording-view', { opacity: 0 });
      gsap.set('.demo-preview-view', { opacity: 0 });
      gsap.set('.demo-editing-view', { opacity: 0 });
      gsap.set('.demo-analyzing-view', { opacity: 0 });
      gsap.set('.demo-success-view', { opacity: 0 });
      gsap.set('.demo-error-toast', { opacity: 0, y: -20 });
      gsap.set('.demo-rec-dot', { scale: 1 });
      gsap.set('.pipeline-step', { opacity: 0.3 });
      gsap.set('.pipeline-check', { scale: 0 });
      gsap.set('.demo-progress-fill', { scaleX: 0, transformOrigin: 'left' });
      gsap.set('.demo-severity-badge', { scale: 0 });
      gsap.set('.demo-type-badge', { scale: 0 });
      gsap.set('.demo-gh-notification', { opacity: 0, y: 20 });
      gsap.set('.demo-confidence', { opacity: 0 });
      gsap.set('.demo-summary-text', { opacity: 0 });

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 2,
        defaults: { ease: 'power3.out' },
      });

      /* 1. FAB bounces in */
      tl.to('.demo-fab', { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' });
      tl.to('.demo-fab', { scale: 1.1, duration: 0.15, yoyo: true, repeat: 1 }, '+=0.3');

      /* 2. Cursor appears, moves to FAB, clicks */
      tl.to('.demo-cursor', { opacity: 1, duration: 0.2 }, '+=0.3');
      tl.to('.demo-cursor', { x: 428, y: 370, duration: 0.7, ease: 'power2.inOut' });
      tl.to('.demo-fab', { scale: 0.9, duration: 0.1 });
      tl.to('.demo-fab', { scale: 1, duration: 0.1 });

      /* 3. Widget springs open */
      tl.to('.demo-widget', {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        ease: 'back.out(1.4)',
      });
      tl.to('.demo-fab', { scale: 0, opacity: 0, duration: 0.2 }, '<');

      /* 4. Cursor moves to "Start Recording" */
      tl.to('.demo-cursor', { x: 340, y: 210, duration: 0.5, ease: 'power2.inOut' }, '+=0.4');
      tl.to('.demo-start-btn', { backgroundColor: '#4f46e5', duration: 0.15 });

      /* 5. Click → switch to recording view */
      tl.to('.demo-start-view', { opacity: 0, duration: 0.2 });
      tl.to('.demo-recording-view', { opacity: 1, duration: 0.2 });
      tl.to('.demo-cursor', { opacity: 0, duration: 0.2 }, '<');

      /* Recording dot pulse */
      tl.to('.demo-rec-dot', {
        scale: 1.3,
        opacity: 0.5,
        duration: 0.5,
        yoyo: true,
        repeat: 3,
        ease: 'sine.inOut',
      });

      /* 6. Error toast appears in the fake app */
      tl.to('.demo-error-toast', { opacity: 1, y: 0, duration: 0.3 }, '-=1.5');

      /* 7. Recording timer ticks */
      tl.to('.demo-timer', {
        duration: 2,
        onUpdate: function () {
          const progress = this.progress();
          const seconds = Math.floor(progress * 8);
          const el = document.querySelector('.demo-timer');
          if (el) el.textContent = `00:0${seconds}`;
        },
      });

      /* 8. Stop recording → preview */
      tl.to('.demo-recording-view', { opacity: 0, duration: 0.2 });
      tl.to('.demo-preview-view', { opacity: 1, duration: 0.2 });

      /* 9. Click "Use this video" → editing */
      tl.to('.demo-preview-view', { opacity: 0, duration: 0.2 }, '+=0.8');
      tl.to('.demo-editing-view', { opacity: 1, duration: 0.2 });

      /* 10. Auto-type title */
      tl.to('.demo-title-input', {
        duration: 1.2,
        onUpdate: function () {
          const text = 'TypeError in Dashboard';
          const chars = Math.floor(this.progress() * text.length);
          const el = document.querySelector('.demo-title-input') as HTMLElement;
          if (el) el.textContent = text.substring(0, chars);
        },
      });

      /* 11. Auto-type description */
      tl.to('.demo-desc-input', {
        duration: 1,
        onUpdate: function () {
          const text = 'Cannot read properties of undefined when clicking settings';
          const chars = Math.floor(this.progress() * text.length);
          const el = document.querySelector('.demo-desc-input') as HTMLElement;
          if (el) el.textContent = text.substring(0, chars);
        },
      }, '-=0.3');

      /* 12. Click "Send Report" → analyzing */
      tl.to('.demo-editing-view', { opacity: 0, duration: 0.2 }, '+=0.5');
      tl.to('.demo-analyzing-view', { opacity: 1, duration: 0.2 });

      /* 13. Progress bar fills */
      tl.to('.demo-progress-fill', { scaleX: 1, duration: 2.5, ease: 'power1.inOut' });

      /* 14. Pipeline steps check off one by one */
      const steps = [0, 1, 2, 3];
      steps.forEach((i, idx) => {
        const offset = idx === 0 ? '-=2.0' : '-=0.5';
        tl.to(`.pipeline-step-${i}`, { opacity: 1, duration: 0.3 }, offset);
        tl.to(`.pipeline-check-${i}`, { scale: 1, duration: 0.3, ease: 'back.out(2)' }, '+=0.2');
      });

      /* 15. Switch to success */
      tl.to('.demo-analyzing-view', { opacity: 0, duration: 0.2 }, '+=0.3');
      tl.to('.demo-success-view', { opacity: 1, duration: 0.2 });

      /* 16. Badges pop in */
      tl.to('.demo-severity-badge', { scale: 1, duration: 0.3, ease: 'back.out(2)' }, '+=0.2');
      tl.to('.demo-type-badge', { scale: 1, duration: 0.3, ease: 'back.out(2)' }, '-=0.1');

      /* 17. Summary types in */
      tl.to('.demo-summary-text', { opacity: 1, duration: 0.3 });
      tl.to('.demo-summary-text', {
        duration: 1.5,
        onUpdate: function () {
          const text =
            'TypeError in SettingsPage.tsx:47 — accessing user.preferences before null check. Occurs when user navigates to settings before profile data loads.';
          const chars = Math.floor(this.progress() * text.length);
          const el = document.querySelector('.demo-summary-text') as HTMLElement;
          if (el) el.textContent = text.substring(0, chars);
        },
      });

      /* 18. Confidence counter climbs */
      tl.to('.demo-confidence', { opacity: 1, duration: 0.2 }, '-=1');
      tl.to('.demo-confidence-num', {
        duration: 1.2,
        onUpdate: function () {
          const val = Math.floor(this.progress() * 87);
          const el = document.querySelector('.demo-confidence-num');
          if (el) el.textContent = `${val}%`;
        },
      }, '-=1');

      /* 19. GitHub notification */
      tl.to('.demo-gh-notification', { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' }, '+=0.3');

      /* 20. Hold for viewing */
      tl.to({}, { duration: 3 });

      /* 21. Reset everything for loop */
      tl.to('.demo-success-view', { opacity: 0, duration: 0.3 });
      tl.to('.demo-gh-notification', { opacity: 0, y: 20, duration: 0.3 }, '<');
      tl.to('.demo-error-toast', { opacity: 0, y: -20, duration: 0.2 }, '<');
      tl.to('.demo-widget', { scale: 0, opacity: 0, duration: 0.3 });

      /* Reset badge/step states for next loop */
      tl.set('.demo-severity-badge', { scale: 0 });
      tl.set('.demo-type-badge', { scale: 0 });
      tl.set('.demo-confidence', { opacity: 0 });
      tl.set('.demo-confidence-num', { innerHTML: '0%' });
      tl.set('.demo-summary-text', { opacity: 0, innerHTML: '' });
      tl.set('.pipeline-step', { opacity: 0.3 });
      tl.set('.pipeline-check', { scale: 0 });
      tl.set('.demo-progress-fill', { scaleX: 0 });
      tl.set('.demo-start-view', { opacity: 1 });
      tl.set('.demo-recording-view', { opacity: 0 });
      tl.set('.demo-preview-view', { opacity: 0 });
      tl.set('.demo-editing-view', { opacity: 0 });
      tl.set('.demo-analyzing-view', { opacity: 0 });
      tl.set('.demo-title-input', { innerHTML: '' });
      tl.set('.demo-desc-input', { innerHTML: '' });
      tl.set('.demo-timer', { innerHTML: '00:00' });
      tl.set('.demo-start-btn', { backgroundColor: '#6366f1' });

      tlRef.current = tl;
    }, browserRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden bg-[#030712] pt-24 sm:pt-32"
    >
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Radial blue glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-blue-500/8 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Text */}
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Watch your bugs{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              fix themselves.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            One SDK. AI-powered diagnosis. Automated fix.
            <br />
            Add one line of code and let AI handle the rest.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#pipeline"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/10 px-6 text-sm font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Browser Mockup */}
        <div className="mx-auto mt-16 max-w-4xl" ref={browserRef}>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1e] shadow-2xl shadow-blue-500/5">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#0d1117] px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <div className="h-3 w-3 rounded-full bg-green-500/70" />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-slate-500">
                yourapp.com/dashboard
              </div>
            </div>

            {/* Fake app content */}
            <div className="relative h-[420px] sm:h-[480px] overflow-hidden">
              {/* Fake app UI background */}
              <div className="absolute inset-0 p-6">
                {/* Fake sidebar */}
                <div className="absolute left-0 top-0 h-full w-48 border-r border-white/5 bg-[#080d19] p-4">
                  <div className="mb-6 h-4 w-20 rounded bg-white/10" />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="mb-3 flex items-center gap-2">
                      <div className="h-3 w-3 rounded bg-white/5" />
                      <div className={`h-2.5 rounded bg-white/${i === 3 ? '15' : '5'}`} style={{ width: `${40 + i * 12}px` }} />
                    </div>
                  ))}
                </div>
                {/* Fake main content */}
                <div className="ml-52">
                  <div className="mb-4 h-5 w-40 rounded bg-white/10" />
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                        <div className="mb-2 h-3 w-16 rounded bg-white/10" />
                        <div className="h-8 w-24 rounded bg-white/5" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <div className="mb-3 h-3 w-24 rounded bg-white/10" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-2.5 w-2.5 rounded-full bg-white/5" />
                          <div className="h-2.5 flex-1 rounded bg-white/[0.04]" />
                          <div className="h-2.5 w-16 rounded bg-white/[0.04]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error toast */}
              <div className="demo-error-toast absolute left-56 top-4 z-10 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/80 px-3 py-2 backdrop-blur">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-300">
                  TypeError: Cannot read properties of undefined
                </span>
              </div>

              {/* ── FAB ── */}
              <div className="demo-fab absolute bottom-5 right-5 z-20 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/30">
                <HelpIcon />
              </div>

              {/* ── Widget modal ── */}
              <div className="demo-widget absolute bottom-5 right-5 z-30 w-[280px] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl">
                {/* Widget header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <span className="text-sm font-medium text-white">Report an Issue</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded text-slate-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                      <line x1={18} y1={6} x2={6} y2={18} />
                      <line x1={6} y1={6} x2={18} y2={18} />
                    </svg>
                  </div>
                </div>

                {/* Widget body - overlapping views */}
                <div className="relative h-[220px]">
                  {/* Start view */}
                  <div className="demo-start-view absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                      <VideoIcon />
                    </div>
                    <p className="mb-4 text-center text-xs text-slate-400">
                      Record your screen to capture the issue
                    </p>
                    <button className="demo-start-btn flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 text-xs font-medium text-white">
                      <Circle className="h-3 w-3 fill-current" />
                      Start Recording
                    </button>
                  </div>

                  {/* Recording view */}
                  <div className="demo-recording-view absolute inset-0 flex flex-col items-center justify-center p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="demo-rec-dot h-3 w-3 rounded-full bg-red-500" />
                      <span className="demo-timer font-mono text-lg text-white">00:00</span>
                    </div>
                    <p className="mb-4 text-xs text-slate-400">Recording in progress...</p>
                    <button className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-500 text-xs font-medium text-white">
                      <div className="h-3 w-3 rounded-sm bg-white" />
                      Stop Recording
                    </button>
                  </div>

                  {/* Preview view */}
                  <div className="demo-preview-view absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                    <div className="flex h-24 w-full items-center justify-center rounded-lg bg-slate-800">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-white/30">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <div className="flex w-full items-center justify-between text-xs text-slate-500">
                      <span>00:08</span>
                      <span>1.2 MB</span>
                    </div>
                    <button className="flex h-9 w-full items-center justify-center rounded-lg bg-indigo-500 text-xs font-medium text-white">
                      Use this video
                    </button>
                  </div>

                  {/* Editing view */}
                  <div className="demo-editing-view absolute inset-0 flex flex-col gap-2.5 p-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-400">Title</label>
                      <div className="demo-title-input min-h-[32px] rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-400">
                        Description
                      </label>
                      <div className="demo-desc-input min-h-[52px] rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white" />
                    </div>
                    <button className="mt-auto flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 text-xs font-medium text-white">
                      <SendIcon />
                      Send Report
                    </button>
                  </div>

                  {/* Analyzing view */}
                  <div className="demo-analyzing-view absolute inset-0 flex flex-col gap-2.5 p-4">
                    <p className="text-center text-xs font-medium text-white">
                      AI is analyzing your report...
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="demo-progress-fill h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
                    </div>
                    <div className="mt-1 space-y-1.5">
                      {['Extracting keyframes', 'Running OCR', 'UI Detection', 'AI Vision Analysis'].map(
                        (step, i) => (
                          <div
                            key={step}
                            className={`pipeline-step pipeline-step-${i} flex items-center gap-2 text-[11px] text-slate-300`}
                          >
                            <div className={`pipeline-check pipeline-check-${i} flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20`}>
                              <Check className="h-2.5 w-2.5 text-emerald-400" />
                            </div>
                            {step}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Success view */}
                  <div className="demo-success-view absolute inset-0 flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20">
                        <Check className="h-3 w-3 text-emerald-400" />
                      </div>
                      <span className="text-xs font-medium text-white">Analysis Complete</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="demo-severity-badge inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                        <AlertTriangle className="h-2.5 w-2.5" /> High
                      </span>
                      <span className="demo-type-badge inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                        <Bug className="h-2.5 w-2.5" /> Bug
                      </span>
                      <span className="demo-confidence ml-auto text-[10px] text-slate-500">
                        Confidence: <span className="demo-confidence-num text-emerald-400">0%</span>
                      </span>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="demo-summary-text text-[11px] leading-relaxed text-slate-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* GitHub notification */}
              <div className="demo-gh-notification absolute bottom-20 right-5 z-40 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/80 px-3 py-2 backdrop-blur">
                <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-300">
                  Issue <span className="font-medium">#423</span> created on GitHub
                </span>
              </div>

              {/* Animated cursor */}
              <div className="demo-cursor pointer-events-none absolute z-50">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 1L4 15L8 11L13 18L15 17L10 10L16 10L4 1Z" fill="white" stroke="#030712" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>

          {/* Glow under browser */}
          <div className="pointer-events-none -mt-px flex justify-center">
            <div className="h-px w-3/4 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030712]" />
    </section>
  );
}
