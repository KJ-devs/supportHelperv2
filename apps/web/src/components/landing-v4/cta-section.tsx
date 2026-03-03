'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Copy } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const SDK_SNIPPET = `<script src="https://cdn.supporthelper.io/sdk.js"
  data-key="sh_live_abc123"
  async>
</script>`;

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.cta-content', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SDK_SNIPPET);
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#030712] py-24 sm:py-32"
    >
      {/* Subtle glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[100px]" />

      <div className="cta-content relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Add one line.{' '}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Let AI handle the rest.
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-slate-400">
          Drop in the SDK, and every bug your users encounter gets automatically
          captured, analyzed, and routed to your team.
        </p>

        {/* Code block */}
        <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1e] text-left">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <span className="text-xs text-slate-500">index.html</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
          </div>
          <pre className="overflow-x-auto p-4">
            <code className="text-sm leading-relaxed">
              <span className="text-slate-500">&lt;</span>
              <span className="text-pink-400">script</span>
              <span className="text-slate-500"> </span>
              <span className="text-blue-400">src</span>
              <span className="text-slate-500">=</span>
              <span className="text-emerald-400">&quot;https://cdn.supporthelper.io/sdk.js&quot;</span>
              {'\n'}
              <span className="text-slate-500">{'  '}</span>
              <span className="text-blue-400">data-key</span>
              <span className="text-slate-500">=</span>
              <span className="text-emerald-400">&quot;sh_live_abc123&quot;</span>
              {'\n'}
              <span className="text-slate-500">{'  '}</span>
              <span className="text-blue-400">async</span>
              <span className="text-slate-500">&gt;&lt;/</span>
              <span className="text-pink-400">script</span>
              <span className="text-slate-500">&gt;</span>
            </code>
          </pre>
        </div>

        {/* CTA buttons */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={`${DASHBOARD_URL}/signup`}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-8 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={`${DASHBOARD_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 px-8 text-sm font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white"
          >
            Read the Docs
          </a>
        </div>

        <p className="mt-6 text-xs text-slate-600">
          Free tier includes 5 AI analyses per month. No credit card required.
        </p>
      </div>
    </section>
  );
}
